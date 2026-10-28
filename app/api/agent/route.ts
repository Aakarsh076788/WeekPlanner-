import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {getChatGPTUser} from '../../chatgpt-auth';
import {readPlanner,updatePlanner} from '../../planner-store';
import {chatSchema,runRoutineAgent,scheduleReply,type ModelResponse} from '../../routine-agent';
import {findFreeSlots,slotRequestSchema,preferencesSchema,defaultPreferences} from '../../scheduling';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
const secrets=()=>env as typeof env&{OPENAI_API_KEY?:string;OPENAI_MODEL?:string};
const inputSchema=z.union([
 chatSchema.extend({action:z.literal('chat')}),slotRequestSchema.extend({action:z.literal('suggest')}),
 z.object({action:z.literal('preferences'),preferences:preferencesSchema}),
]);
const requests=new Map<string,{since:number;count:number}>();
export async function GET(){const user=await getChatGPTUser();if(!user)return json({error:'Sign in to use your assistant.'},401);const {state}=await readPlanner(user.userId);return json({engine:secrets().OPENAI_API_KEY?'gpt':'schedule',preferences:state.schedulingPreferences??defaultPreferences});}
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return json({error:'Sign in to use your assistant.'},401);
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid origin.'},403);
 try{
  const text=await request.text();if(text.length>100000)return json({error:'Please shorten the conversation.'},413);
  let raw;try{raw=JSON.parse(text)}catch{return json({error:'Invalid request.'},400)}
  const parsed=inputSchema.safeParse(raw);if(!parsed.success)return json({error:'Check the dates, duration and planning preferences.'},400);const data=parsed.data;
  if(data.action==='preferences'){const result=await updatePlanner(user.userId,state=>({state:{...state,schedulingPreferences:data.preferences},result:null}));return json({state:result.state,revision:result.revision});}
  const {state,revision}=await readPlanner(user.userId);
  if(data.action==='suggest')return json({suggestions:findFreeSlots(state,data),revision,engine:'schedule'});
  const s=secrets();if(!s.OPENAI_API_KEY)return json({...scheduleReply(state,data),revision});
  const stamp=Date.now(),prior=requests.get(user.userId);if(prior&&stamp-prior.since<60000&&prior.count>=12)return json({error:'Give the assistant a moment, then try again.'},429);
  requests.set(user.userId,{since:prior&&stamp-prior.since<60000?prior.since:stamp,count:prior&&stamp-prior.since<60000?prior.count+1:1});
  if(requests.size>1000)for(const [id,record] of requests)if(stamp-record.since>60000)requests.delete(id);
  const signal=AbortSignal.timeout(45000);
  const result=await runRoutineAgent(state,data,async body=>{
   const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${s.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal});
   if(!response.ok)throw new Error('The AI connection could not complete this request. Free-slot suggestions are still available.');
   return await response.json() as ModelResponse;
  },s.OPENAI_MODEL||'gpt-4.1-mini');
  return json({...result,revision});
 }catch(e){return json({error:e instanceof z.ZodError?'Check the session and planning preferences.':(e as Error).name==='TimeoutError'?'The AI took too long. Try a smaller request.':(e as Error).message||'Could not complete this request.'},400)}
}

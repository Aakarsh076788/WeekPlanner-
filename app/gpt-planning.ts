import {z} from 'zod';
import {dateSchema,timeSchema} from './validation';
import {CATEGORIES,uid,monday,minutes,type Planner,type Task,type PlanResult} from './model';
const short=z.string().trim().max(300);
export const plannedSessionSchema=z.object({
 existing_session_id:z.string().min(1).max(80).optional(),
 date:dateSchema,category:z.enum(CATEGORIES),title:z.string().trim().min(1).max(160),start:timeSchema,end:timeSchema,
 topic:short.default(''),notes:z.string().max(3000).default(''),
 problems:z.array(z.object({title:short.min(1),url:z.string().max(2000).refine(s=>!s||/^https?:\/\//i.test(s)).default('')})).max(30).default([])
}).refine(t=>!t.end||!!t.start,'An end time needs a start time.').refine(t=>!t.end||t.end!==t.start,'Start and end cannot be the same.');
export const proposalSchema=z.object({sessions:z.array(plannedSessionSchema).min(1).max(100)});
export type PlannedSession=z.infer<typeof plannedSessionSchema>;
const normalize=(s:string)=>s.trim().replace(/\s+/g,' ').toLowerCase();
const key=(t:Pick<Task,'date'|'start'|'end'|'category'|'title'>)=>[t.date,t.start,t.end,t.category,normalize(t.title)].join('|');
function interval(t:Pick<Task,'date'|'start'|'end'>){if(!t.start||!t.end)return null;const [h,m]=t.start.split(':').map(Number);const start=Date.parse(t.date+'T00:00:00Z')/60000+h*60+m;return {start,end:start+minutes(t)}}
export function inspectProposal(state:Planner,sessions:PlannedSession[]){
 const existing=Object.values(state.weeks).flatMap(w=>w.tasks);const allIds=new Set<string>();const seen=new Set<string>();
 const candidates:{task:Task;old?:Task}[]=[],duplicates:{title:string;date:string}[]=[];
 for(const s of sessions){const old=s.existing_session_id?existing.find(t=>t.id===s.existing_session_id):undefined;if(s.existing_session_id&&!old)throw new Error('A session to update no longer exists. Read the plan again.');if(old&&allIds.has(old.id))throw new Error('The same session appears twice in this plan.');
 const task:Task={id:old?.id??uid(),date:s.date,category:s.category,title:s.title,start:s.start,end:s.end,topic:s.topic,notes:s.notes,done:old?.done??false,actualMinutes:old?.actualMinutes??null,problems:s.problems.map(p=>{const prev=old?.problems.find(x=>normalize(x.title)===normalize(p.title));return {id:prev?.id??uid(),title:p.title,url:p.url,done:prev?.done??false}})};
 if(old&&seen.has(key(task)))throw new Error('Two session updates resolve to the same date, time and title. Resolve the duplicate first.');if(!old&&(seen.has(key(task))||existing.some(t=>key(t)===key(task)))){duplicates.push({title:task.title,date:task.date});continue}if(old)allIds.add(old.id);seen.add(key(task));candidates.push({task,old});}
 const untouched=existing.filter(t=>!allIds.has(t.id));
 const conflicts:{session:string;date:string;conflictsWith:string;start:string;end:string}[]=[];
 for(let i=0;i<candidates.length;i++){const a=candidates[i].task,ia=interval(a);if(!ia)continue;for(const b of [...untouched,...candidates.slice(0,i).map(x=>x.task)]){const ib=interval(b);if(ib&&ia.start<ib.end&&ib.start<ia.end)conflicts.push({session:a.title,date:a.date,conflictsWith:b.title,start:b.start,end:b.end})}}
 return {candidates,duplicates,conflicts};
}
export function applyProposal(state:Planner,sessions:PlannedSession[],requestId:string,allowConflicts:boolean,fingerprint:string){
 const prior=state.planRequests?.[requestId];if(prior){if(prior.fingerprint!==fingerprint)throw new Error('This request ID was used for a different plan. Use a new ID.');return {state,result:{...prior.result,replayed:true}}}
 const {candidates,duplicates,conflicts}=inspectProposal(state,sessions);if(conflicts.length&&!allowConflicts)throw new Error('Time overlaps detected. Preview the plan, resolve them or explicitly allow the intended overlaps.');
 const next=structuredClone(state);const result:PlanResult={added:0,updated:0,skipped:duplicates.length,sessionIds:[]};
 for(const {task,old} of candidates){if(old){const oldWeek=monday(old.date);next.weeks[oldWeek].tasks=next.weeks[oldWeek].tasks.filter(t=>t.id!==old.id);result.updated++}else result.added++;const w=monday(task.date);next.weeks[w]??={focus:'',tasks:[]};next.weeks[w].tasks.push(task);result.sessionIds.push(task.id);}
 const requests=Object.entries(next.planRequests??{}).slice(-99);next.planRequests={...Object.fromEntries(requests),[requestId]:{fingerprint,result}};
 return {state:next,result:{...result,replayed:false}};
}

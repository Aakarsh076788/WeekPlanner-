export const CATEGORIES = ['Coding','College','Gym','Cooking','Meal prep','Study','Content','Sleep'] as const;
export type Category = typeof CATEGORIES[number];
export type Problem = {id:string;title:string;url:string;done:boolean};
export type Task = {id:string;date:string;category:Category;title:string;start:string;end:string;topic:string;problems:Problem[];notes:string;done:boolean;actualMinutes:number|null};
export type Week = {focus:string;tasks:Task[]};
export type PlanResult = {added:number;updated:number;skipped:number;sessionIds:string[];removed?:number;undoId?:string};
export type Planner = {weeks:Record<string,Week>;lastChange?:{id:string;label:string;beforeWeeks:Record<string,Week|null>;afterWeeks:Record<string,Week|null>};planRequests?:Record<string,{fingerprint:string;result:PlanResult}>};
export type Operation = {type:'ensure';week:string}|{type:'upsert';week:string;task:Task}|{type:'toggle';week:string;id:string;done:boolean}|{type:'problem';week:string;id:string;problemId:string;done:boolean}|{type:'remove';week:string;id:string}|{type:'copy';week:string;from:string}|{type:'focus';week:string;focus:string};
export const uid=()=>{if(crypto.randomUUID)return crypto.randomUUID();const b=crypto.getRandomValues(new Uint8Array(16));return Array.from(b,n=>n.toString(16).padStart(2,'0')).join('')};
export function addDays(date:string,n:number){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
export function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
export function monday(date:string){const d=new Date(date+'T12:00:00Z');return addDays(date,-((d.getUTCDay()+6)%7))}
export function minutes(t:Pick<Task,'start'|'end'>){if(!t.start||!t.end)return 0;const [h,m]=t.start.split(':').map(Number),[hh,mm]=t.end.split(':').map(Number);return (hh*60+mm-h*60-m+1440)%1440}
export function taskComplete(task:Task){return task.done&&task.problems.every(p=>p.done)}
export function dayStats(tasks:Task[]){const done=tasks.filter(taskComplete).length;return {total:tasks.length,done,percent:tasks.length?Math.round(done/tasks.length*100):0}}
export function streak(state:Planner,date=today()){let n=0,d=date;const all=Object.values(state.weeks).flatMap(w=>w.tasks);const complete=(v:string)=>{const t=all.filter(x=>x.date===v);return t.length>0&&t.every(taskComplete)};if(!complete(d))d=addDays(d,-1);while(complete(d)){n++;d=addDays(d,-1);if(n>3660)break}return n}
export function seedWeek(start:string):Week{
 const tasks:Task[]=[];
 const add=(day:number,category:Category,title:string,time:string,end:string,topic='',problems:Partial<Problem>[]=[],notes='')=>tasks.push({id:uid(),date:addDays(start,day),category,title,start:time,end,topic,problems:problems.map(p=>({id:uid(),title:p.title||'',url:p.url||'',done:false})),notes,done:false,actualMinutes:null});
 const ps=[['Running Sum of 1d Array','running-sum-of-1d-array','1480'],['Find Pivot Index','find-pivot-index','724'],['Best Time to Buy and Sell Stock','best-time-to-buy-and-sell-stock','121'],['Maximum Subarray','maximum-subarray','53'],['Move Zeroes','move-zeroes','283']];
 for(let d=0;d<7;d++){
  if(d<6)add(d,'Gym','Gym & movement','05:00','07:00','',[],'');
  add(d,'Cooking','Post-gym breakfast','07:00','07:30','',[], 'Protein oats / milk shake');
  if(d<5)add(d,'College','College','08:15','16:00','',[], 'Leave at 8:00 · home around 4:30');
  add(d,'Cooking','Cook dinner','17:00','17:45','',[], 'Chicken, rice & curd');
  if(d<5){const p=ps[d];add(d,'Coding','Java + DSA practice','18:00','19:15','Arrays',[{title:`LC ${p[2]} · ${p[0]}`,url:`https://leetcode.com/problems/${p[1]}/`}],'Understand the approach, code in Java, review time and space complexity.');add(d,'Study','Core CS / college revision','19:30','20:00',d===0?'DBMS · primary keys & foreign keys':'Review today’s classes',[],d===0?'Answer 5 practice questions.':'Choose one concrete topic before starting.');}
  else add(d,'Coding',d===5?'Arrays · revise & retry':'Plan next coding week','10:00','11:15',d===5?'Arrays revision':'Strings & hashing',[],d===5?'Retry problems that needed hints.':'Next: strings / hashing → two pointers / sliding window → binary search.');
  if(d===5)add(d,'Content','Plan & script 1–2 reels','14:00','15:15','College vs gym routine',[],'Alternative idea: DSA beginner struggles.');
  if(d===6)add(d,'Content','Record & edit','14:00','15:45','Batch 1–2 reels',[],'Use Saturday’s scripts.');
  add(d,'Meal prep','Prep tomorrow’s meals','21:00','21:30');
  add(d,'Sleep','Sleep · log your night','23:30','','',[],'Current bedtime: 11:30 PM. Add your wake time and actual sleep in the editor.');
 }
 return {focus:'Arrays in Java · one problem at a time',tasks};
}
export function applyOperation(state:Planner,op:Operation):Planner{
 const next=structuredClone(state);const week=next.weeks[op.week]??{focus:'',tasks:[]};next.weeks[op.week]=week;
 if(op.type==='ensure')return next;
 if(op.type==='copy'){const source=next.weeks[op.from];if(week.tasks.length)throw new Error('This week already has sessions. Copy into an empty week.');if(!source)throw new Error('No previous plan to copy.');const offset=Math.round((new Date(op.week).getTime()-new Date(op.from).getTime())/86400000);week.focus=source.focus;week.tasks=source.tasks.map(t=>({...t,id:uid(),date:addDays(t.date,offset),done:false,actualMinutes:null,problems:t.problems.map(p=>({...p,id:uid(),done:false}))}));}
 if(op.type==='focus')week.focus=op.focus;
 if(op.type==='upsert'){for(const w of Object.values(next.weeks))w.tasks=w.tasks.filter(t=>t.id!==op.task.id);week.tasks.push(op.task);}
 if(op.type==='remove')week.tasks=week.tasks.filter(t=>t.id!==op.id);
 if(op.type==='toggle'){const t=week.tasks.find(t=>t.id===op.id);if(t)t.done=op.done;}
 if(op.type==='problem'){const p=week.tasks.find(t=>t.id===op.id)?.problems.find(p=>p.id===op.problemId);if(p)p.done=op.done;}
 return next;
}

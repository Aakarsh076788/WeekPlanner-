import {z} from 'zod';
import {addDays,minutes,taskComplete,type Planner,type Task,type SchedulingPreferences} from './model';
import {dateSchema,timeSchema} from './validation';
import {kolkataClock,movePlan,taskPhase} from './daily-work';

export const defaultPreferences:SchedulingPreferences={earliest:'08:00',latest:'22:30',bufferMinutes:10,dailyStudyLimit:180};
export const preferencesSchema=z.object({
 earliest:timeSchema.refine(Boolean),latest:timeSchema.refine(Boolean),
 bufferMinutes:z.number().int().min(0).max(60),dailyStudyLimit:z.number().int().min(30).max(720),
}).refine(p=>p.earliest<p.latest,'The planning window must end after it starts.');
export const slotRequestSchema=z.object({sessionId:z.string().min(1).max(80),fromDate:dateSchema.optional(),days:z.number().int().min(1).max(14).default(7),durationMinutes:z.number().int().min(15).max(720).optional()});
export type SlotRequest=z.input<typeof slotRequestSchema>;
export type SlotSuggestion={id:string;sessionId:string;title:string;date:string;start:string;end:string;durationMinutes:number;reason:string;assumptions:string[];plan:ReturnType<typeof movePlan>};
const hm=(n:number)=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
const toMinutes=(s:string)=>{const [h,m]=s.split(':').map(Number);return h*60+m};
const epoch=(date:string,time:string)=>Date.parse(`${date}T${time}:00+05:30`)/60000;
const study=(t:Task)=>t.category==='Coding'||t.category==='Study';

export function findFreeSlots(state:Planner,input:SlotRequest,instant=new Date()):SlotSuggestion[]{
 const request=slotRequestSchema.parse(input),all=Object.values(state.weeks).flatMap(w=>w.tasks),task=all.find(t=>t.id===request.sessionId);
 if(!task)throw new Error('That session no longer exists. Refresh your plan.');
 if(taskComplete(task))throw new Error('This session and all its problems are already complete.');
 if(task.category==='Sleep')throw new Error('Set bedtime and wake time in the session editor. Free-slot suggestions protect sleep and are for daytime work.');
 const prefs=preferencesSchema.parse(state.schedulingPreferences??defaultPreferences),clock=kolkataClock(instant),from=request.fromDate&&request.fromDate>clock.date?request.fromDate:clock.date;
 const originalDuration=minutes(task),duration=request.durationMinutes??(originalDuration||45),originalStart=task.start?toMinutes(task.start):18*60;
 const busy=all.filter(t=>t.id!==task.id&&t.start).map(t=>{
  const start=epoch(t.date,t.start);let length=minutes(t);
  if(!t.end)length=t.category==='Sleep'?epoch(addDays(t.date,1),prefs.earliest)-start:30;
  // College reserves the half-hour commute as well as the session itself.
  const pad=t.category==='College'?Math.max(30,prefs.bufferMinutes):prefs.bufferMinutes;
  return {start:start-pad,end:start+length+pad,task:t};
 });
 const candidates:{slot:SlotSuggestion;score:number}[]=[];
 for(let offset=0;offset<request.days;offset++){
  const date:string=addDays(from,offset);const onDate:Task[]=all.filter(t=>t.id!==task.id&&t.date===date);const plannedStudy:number=onDate.filter(study).reduce((n,t)=>n+(minutes(t)||(t.start?30:45)),0);
  if(study(task)&&plannedStudy+duration>prefs.dailyStudyLimit)continue;
  const windowStart=toMinutes(prefs.earliest),windowEnd=toMinutes(prefs.latest),dayStart=epoch(date,'00:00');
  const available:{slot:SlotSuggestion;score:number}[]=[];
  for(let start=Math.ceil(windowStart/15)*15;start+duration<=windowEnd;start+=15){
   const a=dayStart+start,b=a+duration;
   if(a<instant.getTime()/60000+15||busy.some(x=>a<x.end&&b>x.start))continue;
   if(task.date===date&&task.start===hm(start)&&task.end===hm(start+duration))continue;
   const before=busy.filter(x=>x.end<=a&&x.end>=dayStart).sort((x,y)=>y.end-x.end)[0];
   const after=busy.filter(x=>x.start>=b&&x.start<dayStart+1440).sort((x,y)=>x.start-y.start)[0];
   const assumptions:string[]=[];
   if(!originalDuration&&!request.durationMinutes)assumptions.push('45-minute estimate because this session has no duration.');
   if(!onDate.length)assumptions.push('No other sessions are saved for this day. Check commitments outside Weekcraft.');
   if(onDate.some(t=>!t.start))assumptions.push('Untimed tasks still need room; they do not reserve a fixed slot.');
   if(onDate.some(t=>study(t)&&!minutes(t)))assumptions.push('Untimed study counts as 45 minutes, or 30 minutes for a start-only session, toward the daily study limit.');
   if(onDate.some(t=>t.start&&!t.end&&t.category!=='Sleep'))assumptions.push('Start-only sessions reserve 30 minutes.');
   const neighbour=before?`after ${before.task.title}`:after?`before ${after.task.title}`:'inside your planning window';
   const reason=`${duration} minutes ${neighbour}, with no saved time overlaps.${study(task)?` ${plannedStudy+duration}/${prefs.dailyStudyLimit} study minutes planned for this day.`:''}`;
   const slot:SlotSuggestion={id:`${task.id}:${date}:${hm(start)}:${duration}`,sessionId:task.id,title:task.title,date,start:hm(start),end:hm(start+duration),durationMinutes:duration,reason,assumptions,plan:movePlan(task,date,hm(start),hm(start+duration))};
   available.push({slot,score:offset*10000+Math.abs(start-originalStart)+plannedStudy});
  }
  available.sort((a,b)=>a.score-b.score);
  // Keep alternatives meaningfully different, with at most two per day.
  const chosen:{slot:SlotSuggestion;score:number}[]=[];
  for(const candidate of available){if(chosen.length===2)break;if(chosen.every(c=>Math.abs(toMinutes(c.slot.start)-toMinutes(candidate.slot.start))>=duration+30))chosen.push(candidate)}
  candidates.push(...chosen);
 }
 return candidates.sort((a,b)=>a.score-b.score).slice(0,3).map(c=>c.slot);
}

export function routineContext(state:Planner,referenceDate:string,instant=new Date()){
 const all=Object.values(state.weeks).flatMap(w=>w.tasks),date=kolkataClock(instant).date;
 const pending=all.filter(t=>taskPhase(t,instant)==='pending').sort((a,b)=>b.date.localeCompare(a.date));
 const next=all.filter(t=>!taskComplete(t)&&taskPhase(t,instant)!=='pending'&&t.date>=date).sort((a,b)=>a.date.localeCompare(b.date)||(a.start||'24:00').localeCompare(b.start||'24:00'));
 const dated=all.filter(t=>t.date===referenceDate),problems=dated.flatMap(t=>t.problems);
 return {date,referenceDate,timezone:'Asia/Kolkata',preferences:state.schedulingPreferences??defaultPreferences,
  counts:{planned:dated.length,complete:dated.filter(taskComplete).length,problems:problems.length,solved:problems.filter(p=>p.done).length,pending:pending.length},
  pending:pending.slice(0,40),next:next.slice(0,8)};
}

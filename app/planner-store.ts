import {getDb} from '../db';
import {planners} from '../db/schema';
import {eq,and} from 'drizzle-orm';
import {seedWeek,monday,today,type Planner} from './model';
async function row(userId:string){const db=getDb();let [r]=await db.select().from(planners).where(eq(planners.userId,userId));if(!r){await db.insert(planners).values({userId,data:JSON.stringify({weeks:{[monday(today())]:seedWeek(monday(today()))}}),revision:0}).onConflictDoNothing();[r]=await db.select().from(planners).where(eq(planners.userId,userId));}return r;}
export async function readPlanner(userId:string){const r=await row(userId);return {state:JSON.parse(r.data) as Planner,revision:r.revision};}
export async function updatePlanner<T>(userId:string,change:(state:Planner,revision:number)=>{state:Planner;result:T}){const db=getDb();for(let i=0;i<8;i++){const r=await row(userId);const next=change(JSON.parse(r.data),r.revision);const result=await db.update(planners).set({data:JSON.stringify(next.state),revision:r.revision+1}).where(and(eq(planners.userId,userId),eq(planners.revision,r.revision))).returning({revision:planners.revision});if(result.length)return {state:next.state,revision:result[0].revision,result:next.result};}throw new Error('Another update is finishing. Please retry.');}

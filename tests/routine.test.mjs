import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';

// Compile the actual shared modules; no duplicated implementation in tests.
const root = path.resolve(import.meta.dirname, '..');
const temp = await mkdtemp(path.join(root, 'node_modules/.weekcraft-tests-'));
let passed = 0;
const check = (name, test) => {test(); passed++; console.log(`✓ ${name}`);};
try {
  for (const name of ['model', 'validation', 'gpt-planning', 'direct-planning', 'daily-work']) {
    const source = await readFile(path.join(root, `app/${name}.ts`), 'utf8');
    const {outputText} = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext}});
    await writeFile(path.join(temp, `${name}.mjs`), outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.mjs'"));
  }
  const load = name => import(pathToFileURL(path.join(temp, `${name}.mjs`)));
  const {monday, applyOperation,dayStats} = await load('model');
  const {taskSchema} = await load('validation');
  const {taskPhase, dailyWork, movePlan, kolkataClock} = await load('daily-work');
  const {applyChange, previewChange, undoChange, quickPlan} = await load('direct-planning');
  const instant = new Date('2026-10-28T19:30:00+05:30');
  const task = {id:'coding',date:'2026-10-28',category:'Coding',title:'Linked List',start:'19:00',end:'20:00',topic:'Pointers',notes:'Review approach',done:false,actualMinutes:20,problems:[{id:'p1',title:'Add Two Numbers',url:'https://leetcode.com/problems/add-two-numbers/',done:true},{id:'p2',title:'Reverse Linked List',url:'https://leetcode.com/problems/reverse-linked-list/',done:false}]};
  const state = {weeks:{[monday(task.date)]:{focus:'DSA',tasks:[task]}}};
  check('IST midnight rolls the local date forward',()=>assert.equal(kolkataClock(new Date('2026-10-28T19:00:00Z')).date,'2026-10-29'));
  check('Current session is happening now',()=>assert.equal(taskPhase(task,instant),'now'));
  check('Exact end becomes pending without a checkbox click',()=>assert.equal(taskPhase(task,new Date('2026-10-28T20:00:00+05:30')),'pending'));
  check('Upcoming sessions remain upcoming',()=>assert.equal(taskPhase({...task,start:'21:00',end:'22:00'},instant),'upcoming'));
  check('Untimed work remains available all day',()=>assert.equal(taskPhase({...task,start:'',end:''},instant),'anytime'));
  check('Yesterday untimed work becomes pending',()=>assert.equal(taskPhase({...task,date:'2026-10-27',start:'',end:''},instant),'pending'));
  check('Overnight session stays active after midnight',()=>assert.equal(taskPhase({...task,date:'2026-10-27',start:'23:30',end:'20:00'},instant),'now'));
  check('Completed work never becomes pending',()=>assert.equal(taskPhase({...task,date:'2026-10-26',done:true,problems:task.problems.map(p=>({...p,done:true}))},instant),'done'));
  check('Unchecked problems keep a checked session pending',()=>assert.equal(taskPhase({...task,done:true},new Date('2026-10-28T21:00:00+05:30')),'pending'));
  check('Completion metrics wait for session and all problems',()=>assert.equal(dayStats([{...task,done:true}]).done,0));
  check('Start-only session ends at next local midnight',()=>assert.equal(taskPhase({...task,date:'2026-10-27',start:'23:30',end:''},instant),'pending'));
  const old={...task,id:'old',date:'2026-10-19'},done={...task,id:'done',date:'2026-10-27',done:true,problems:[]},future={...task,id:'future',date:'2026-10-29'};
  const history={weeks:{...state.weeks,'2026-10-19':{focus:'',tasks:[old]},'2026-10-26':{focus:'DSA',tasks:[task,done,future]}}};
  check('Today collects older pending tasks once, excludes old completed and future work',()=>assert.deepEqual(dailyWork(history,task.date,instant).map(t=>t.id),['old','coding']));
  check('Historical date does not duplicate the global pending queue',()=>assert.deepEqual(dailyWork(history,old.date,instant).map(t=>t.id),['old']));
  const plan=movePlan(task,'2026-11-02','18:00','19:00');
  check('Reschedule preview is read-only',()=>{previewChange(state,plan);assert.equal(state.weeks['2026-10-26'].tasks[0].date,task.date)});
  const moved=applyChange(state,plan,'move-1',false,JSON.stringify(plan));
  const movedTask=moved.state.weeks['2026-11-02'].tasks[0];
  check('Cross-week move keeps one session and its identity',()=>{assert.equal(moved.state.weeks['2026-10-26'].tasks.length,0);assert.equal(movedTask.id,task.id);assert.equal(Object.values(moved.state.weeks).flatMap(w=>w.tasks).length,1)});
  check('Move preserves problem links, IDs, completion, notes, and actual time',()=>{assert.deepEqual(movedTask.problems,task.problems);assert.equal(movedTask.actualMinutes,20);assert.equal(movedTask.notes,task.notes)});
  check('Retrying a move cannot create copies',()=>assert.equal(Object.values(applyChange(moved.state,plan,'move-1',false,JSON.stringify(plan)).state.weeks).flatMap(w=>w.tasks).length,1));
  check('Undo restores the exact original schedule and progress',()=>assert.deepEqual(undoChange(moved.state,moved.result.undoId).weeks,state.weeks));
  const collision={weeks:{'2026-10-26':{focus:'',tasks:[task,{...task,id:'other',date:'2026-10-29',title:'College',start:'19:15',end:'20:15'}]}}};
  check('Overlaps are detected before moving',()=>assert.equal(previewChange(collision,movePlan(task,'2026-10-29')).conflicts.length,1));
  check('Unapproved overlap is rejected',()=>assert.throws(()=>applyChange(collision,movePlan(task,'2026-10-29'),'conflict',false,'conflict'),/overlap/i));
  check('Manual date edits across weeks also remove the original',()=>{const changed=applyOperation(state,{type:'upsert',week:'2026-11-02',task:{...task,date:'2026-11-02'}});assert.equal(changed.weeks['2026-10-26'].tasks.length,0);assert.equal(changed.weeks['2026-11-02'].tasks[0].id,task.id)});
  check('Day-after-tomorrow commands use two days, clean titles, and retain problems',()=>{const result=quickPlan('Add Java arrays day after tomorrow 7–8 PM with LC 724',state,task.date);assert.equal(result.sessions[0].date,'2026-10-30');assert.equal(result.sessions[0].title,'Java arrays');assert.equal(result.sessions[0].problems[0].title,'LC 724')});
  check('Manual end-only and zero-duration sessions are rejected',()=>{assert.equal(taskSchema.safeParse({...task,start:''}).success,false);assert.equal(taskSchema.safeParse({...task,end:task.start}).success,false)});
  check('Unsafe problem link schemes are rejected',()=>assert.equal(taskSchema.safeParse({...task,problems:[{...task.problems[0],url:'javascript:alert(1)'}]}).success,false));
  console.log(`${passed} checks passed.`);
} finally {await rm(temp,{recursive:true,force:true});}

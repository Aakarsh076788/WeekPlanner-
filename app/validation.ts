import {z} from 'zod';
import {monday,CATEGORIES} from './model';
export const dateSchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s,'Use a real YYYY-MM-DD date.');
export const weekSchema=dateSchema.refine(s=>monday(s)===s,'A week starts on Monday.');
export const timeSchema=z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$|^$/);
export const problemSchema=z.object({id:z.string().min(1).max(80),title:z.string().trim().min(1).max(300),url:z.string().max(2000).refine(s=>!s||/^https?:\/\//i.test(s)),done:z.boolean()});
export const taskSchema=z.object({id:z.string().min(1).max(80),date:dateSchema,category:z.enum(CATEGORIES),title:z.string().trim().min(1).max(160),start:timeSchema,end:timeSchema,topic:z.string().max(300),problems:z.array(problemSchema).max(30),notes:z.string().max(3000),done:z.boolean(),actualMinutes:z.number().int().min(0).max(1440).nullable()});
export const operationSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('ensure'),week:weekSchema}),z.object({type:z.literal('upsert'),week:weekSchema,task:taskSchema}),z.object({type:z.literal('toggle'),week:weekSchema,id:z.string(),done:z.boolean()}),z.object({type:z.literal('problem'),week:weekSchema,id:z.string(),problemId:z.string(),done:z.boolean()}),z.object({type:z.literal('remove'),week:weekSchema,id:z.string()}),z.object({type:z.literal('copy'),week:weekSchema,from:weekSchema}),z.object({type:z.literal('focus'),week:weekSchema,focus:z.string().max(300)})]);

import {z} from 'zod';
const id=z.string().min(1).max(180),note=z.string().trim().min(1).max(1000);
export const sourceSchema=z.enum(['simulation','live']);
export const commandSchema=z.union([
 z.object({type:z.literal('ack'),id}).strict(),
 z.object({type:z.literal('care'),id,action:z.string().trim().min(1).max(200),note:z.string().max(1000).optional(),recover:z.boolean().optional()}).strict(),
 z.object({type:z.literal('assist'),id,recover:z.boolean()}).strict(),
 z.object({type:z.literal('note'),id,text:note}).strict(),
 z.object({type:z.literal('audit'),id:id.optional(),message:z.string().max(200),kind:z.enum(['activity','device']).optional()}).strict(),
 z.object({type:z.literal('read'),id}).strict(),
 z.object({type:z.literal('scenario'),id,name:z.enum(['Normal patient','Low bottle','High pressure','Air bubble','Possible fluid leakage warning','Possible swelling warning','Critical IV-site warning','ESP32 #1 offline','ESP32 #2 offline','Node-RED disconnected'])}).strict(),
 z.object({type:z.literal('sensor'),id,module:z.enum(['esp32_1','esp32_2','gateway']),key:z.string(),value:z.union([z.number().finite(),z.boolean()])}).strict().refine(a=>{
  const numeric=a.module==='esp32_1'?['bottle_level','pressure']:a.module==='esp32_2'?['moisture','strain']:[];
  const bool=a.module==='esp32_1'?['connected','air_bubble']:a.module==='esp32_2'?['connected']:['esp_now','wifi','node_red'];
  return numeric.includes(a.key)?typeof a.value==='number'&&a.value>=0&&a.value<=100:bool.includes(a.key)&&typeof a.value==='boolean';
 }),
 z.object({type:z.literal('drop'),id}).strict(),z.object({type:z.literal('auto'),value:z.boolean()}).strict(),z.object({type:z.literal('reset')}).strict(),
 z.object({type:z.literal('assign'),id,nurse:z.string().trim().min(1).max(100)}).strict(),
 z.object({type:z.literal('handover'),text:z.string().max(10000)}).strict(),z.object({type:z.literal('complete')}).strict(),
 z.object({type:z.literal('prefs'),value:z.object({privacy:z.boolean().optional(),sound:z.boolean().optional(),vibration:z.boolean().optional(),criticalSound:z.boolean().optional(),warningSound:z.boolean().optional(),reminders:z.boolean().optional(),criticalInterval:z.number().int().min(0).max(1440).optional(),warningInterval:z.number().int().min(0).max(1440).optional(),escalation:z.boolean().optional(),escalationInterval:z.number().int().min(0).max(1440).optional(),supervisor:z.string().max(100).optional(),timeout:z.number().int().min(1).max(120).optional()}).strict()}).strict(),
]);
export const actionBody=z.object({source:sourceSchema,version:z.number().int().nonnegative(),action:commandSchema}).strict();

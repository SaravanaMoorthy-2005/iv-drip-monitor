'use client';
import {Sparkles,ArrowRight} from 'lucide-react';
import {getCareRecommendation} from '@/lib/tissense/care-assistant';
import type {Alert,Patient} from '@/lib/tissense/engine';
import type {State} from '@/lib/tissense/store';
import {LiquidButton} from '@/components/ui/liquid-glass-button';

export function CareRecommendation({alert,patient,s,d,onRecord}:{alert:Alert;patient:Patient;s:State;d:(a:any)=>void;onRecord:()=>void}){
 const plan=getCareRecommendation(alert,patient,s.now);
 if(alert.resolved)return null;
 const demo=s.mode==='simulation';
 return <section className="care-assistant" aria-label={`Recommendation for ${alert.message}`}>
  <div className="assistant-heading"><Sparkles size={17}/><b>Care assistant</b><span>{demo?'AI assist preview · rule-based':'Rule-based guidance'}</span></div>
  <h4>{plan.title}</h4><p className="assistant-evidence">{plan.evidence}</p>
  <details><summary>Suggested checks & recovery criteria</summary><ol>{plan.steps.map(x=><li key={x}>{x}</li>)}</ol><p>Use clinical judgment and your local protocol. These are predefined suggestions, not a diagnosis or an AI model response.</p>{['critical','moisture','strain'].includes(alert.key)&&<a href="https://www.cdc.gov/infection-control/hcp/intravascular-catheter-related-infections/summary-recommendations.html" target="_blank" rel="noreferrer">CDC guidance on insertion-site assessment ↗</a>}</details>
  {demo&&plan.canRecover?<><LiquidButton className="assistant-recover" onClick={()=>d({type:'assist',id:alert.id,recover:true})}><Sparkles size={16}/> Apply demo recovery <ArrowRight size={16}/></LiquidButton><small>One click records the demo action and updates the affected simulated readings. It does not treat a patient.</small></>:<><LiquidButton variant="outline" onClick={onRecord}>Review & record action <ArrowRight size={16}/></LiquidButton><small>{plan.recoveryBlocked}</small></>}
 </section>;
}

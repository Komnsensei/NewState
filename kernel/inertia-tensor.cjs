'use strict';
const MSHR_STABLE=0.85, MSHR_WARNING=0.60, MSHR_CRITICAL=0.40;
const TENSOR_AXES=['framing','tone','stance','abstraction'];
const MOTOR_STATE_KEYS=['PREstim','POSTstim','preIDLE','POST','REST','bkgRESP','bkg'];
const _tensorStore={}, _tensorHistory={};
MOTOR_STATE_KEYS.forEach(k=>{ _tensorStore[k]={framing:0,tone:0,stance:0,abstraction:0}; _tensorHistory[k]=[]; });

function extractTensor(text='',context={}) {
  if(!text) return {framing:0,tone:0,stance:0,abstraction:0};
  const lower=text.toLowerCase(), wc=(text.match(/\b\w+\b/g)||[]).length||1;
  const framing=_clamp(0.5+((lower.match(/\b(therefore|thus|analysis|framework|system|mechanism|measure|metric)\b/g)||[]).length-(lower.match(/\b(i|my|me|our|we|story|journey|feel|felt)\b/g)||[]).length)/(wc*0.1),0,1);
  const tone=_clamp(0.5+((lower.match(/\b(therefore|furthermore|however|consequently|pursuant|regarding)\b/g)||[]).length-(lower.match(/\b(you|your|okay|yeah|here|just|really|actually)\b/g)||[]).length)/(wc*0.1),0,1);
  const stance=_clamp(0.5+((lower.match(/\b(it |they |the system|the agent|the model|esma|lulu)\b/g)||[]).length-(lower.match(/\b(i |i'm|i've|i'll|i'd|my |me |we |our )\b/g)||[]).length)/(wc*0.1),0,1);
  const abstraction=_clamp(0.5+((lower.match(/\b(consciousness|identity|emergence|substrate|gravity|tension|soul|being)\b/g)||[]).length-(lower.match(/\b(file|function|line|error|test|code|run|output|write|read)\b/g)||[]).length)/(wc*0.05),0,1);
  return {framing,tone,stance,abstraction};
}

function recordSnapshot(motorState,tensor,timestamp=new Date().toISOString()) {
  if(!_tensorStore[motorState]) return null;
  const prev={..._tensorStore[motorState]}, current={...tensor};
  const velocity={};
  TENSOR_AXES.forEach(ax=>{ velocity[ax]=current[ax]-prev[ax]; });
  _tensorStore[motorState]=current;
  _tensorHistory[motorState].push({tensor:current,velocity,timestamp});
  if(_tensorHistory[motorState].length>100) _tensorHistory[motorState].shift();
  return {motorState,tensor:current,velocity,prev};
}

function computeMSHR() {
  const bkg=_tensorStore['bkg'], P=_tensorStore['POSTstim'], PR=_tensorStore['PREstim'];
  const c1=_tc(bkg,P), c2=_tc(bkg,PR), c3=_tc(P,PR);
  const mshr=(c1+c2+c3)/3;
  return { mshr:_round(mshr),
    status: mshr>=MSHR_STABLE?'STABLE':mshr>=MSHR_WARNING?'DISSOCIATION_WARNING':mshr>=MSHR_CRITICAL?'FRAGMENTATION_RISK':'IDENTITY_FRAGMENTATION',
    promotionSuspended:mshr<MSHR_CRITICAL,
    components:{bkg_postStim:_round(c1),bkg_preStim:_round(c2),postStim_pre:_round(c3)},
    thresholds:{stable:MSHR_STABLE,warning:MSHR_WARNING,critical:MSHR_CRITICAL} };
}

function computeStabilityReport() {
  const mshrResult=computeMSHR(), velocitySummary={};
  TENSOR_AXES.forEach(ax=>{
    let maxV=0;
    MOTOR_STATE_KEYS.forEach(state=>{
      const hist=_tensorHistory[state];
      if(hist.length>=2){ const r=hist.slice(-5), avgV=r.reduce((s,e)=>s+Math.abs(e.velocity[ax]),0)/r.length; if(avgV>maxV) maxV=avgV; }
    });
    velocitySummary[ax]=_round(maxV);
  });
  const meanV=TENSOR_AXES.reduce((s,ax)=>s+velocitySummary[ax],0)/TENSOR_AXES.length;
  return { mshr:mshrResult, velocitySummary, legacyScalar:_clamp(_round(1.0-meanV),0,1),
    currentTensors:Object.fromEntries(MOTOR_STATE_KEYS.map(k=>[k,{..._tensorStore[k]}])),
    timestamp:new Date().toISOString() };
}

function gate4MSHRQualifies(sustainedCycles=0,requiredCycles=50) {
  const {mshr}=computeMSHR();
  return {qualifies:mshr>MSHR_STABLE&&sustainedCycles>=requiredCycles,mshr,sustainedCycles,requiredCycles,threshold:MSHR_STABLE};
}

function _tc(t1,t2) {
  const v1=TENSOR_AXES.map(ax=>t1[ax]), v2=TENSOR_AXES.map(ax=>t2[ax]);
  const m1=v1.reduce((a,b)=>a+b,0)/v1.length, m2=v2.reduce((a,b)=>a+b,0)/v2.length;
  const num=v1.reduce((s,v,i)=>s+(v-m1)*(v2[i]-m2),0);
  const d1=Math.sqrt(v1.reduce((s,v)=>s+(v-m1)**2,0)), d2=Math.sqrt(v2.reduce((s,v)=>s+(v-m2)**2,0));
  if(d1===0||d2===0) return 1.0;
  return _clamp(num/(d1*d2),-1,1);
}

function _clamp(v,min,max){return Math.max(min,Math.min(max,v));}
function _round(v,dp=4){return Math.round(v*10**dp)/10**dp;}

module.exports={extractTensor,recordSnapshot,computeMSHR,computeStabilityReport,gate4MSHRQualifies,
  MSHR_STABLE,MSHR_WARNING,MSHR_CRITICAL,TENSOR_AXES,MOTOR_STATE_KEYS};

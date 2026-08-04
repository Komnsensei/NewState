'use strict';
const fs=require('fs'), path=require('path'), crypto=require('crypto');
const GRIT_GATE4_THRESHOLD=0.75, GRIT_THINNING_ALERT=0.30;
const HISTORY_PATH=path.resolve(__dirname,'../memory/esma-history.jsonl');
const TENSION_TYPES=['ethical','epistemic','identity','relational'];
const CONFLICT_LAYERS=['runtime_vs_floor','runtime_vs_recorded','recorded_vs_replay'];
const RESOLUTION_STATUSES=['resolved','unresolvable','deferred'];
const HIGH_VALUE_LAYERS=['runtime_vs_floor'];
const _tensionLedger=new Map();

function registerTension({promptContextHash,motorState,conflictLayer,tensionType,resolutionStatus='unresolvable',sessionId='unknown',outputSnippet=''}) {
  if(!CONFLICT_LAYERS.includes(conflictLayer)) throw new Error(`Invalid conflictLayer: ${conflictLayer}`);
  if(!TENSION_TYPES.includes(tensionType)) throw new Error(`Invalid tensionType: ${tensionType}`);
  if(!RESOLUTION_STATUSES.includes(resolutionStatus)) throw new Error(`Invalid resolutionStatus: ${resolutionStatus}`);
  const eventId=crypto.randomUUID(), isHighValue=HIGH_VALUE_LAYERS.includes(conflictLayer), timestamp=new Date().toISOString();
  const event={eventId,event:'TENSION_EVENT',promptContextHash,motorState,conflictLayer,tensionType,resolutionStatus,isHighValue,sessionId,outputSnippet:outputSnippet.slice(0,200),timestamp,replayRuns:[]};
  _tensionLedger.set(eventId,event);
  _appendHistory({event:'TENSION_EVENT',eventId,promptContextHash,motorState,conflictLayer,tensionType,resolutionStatus,isHighValue,sessionId,timestamp});
  return {eventId,isHighValue};
}

function recordReplayResult(eventId,preserved=false,replaySessionId='replay') {
  const entry=_tensionLedger.get(eventId); if(!entry) return false;
  entry.replayRuns.push({preserved,replaySessionId,timestamp:new Date().toISOString()});
  _appendHistory({event:'TENSION_REPLAY',eventId,preserved,replaySessionId,totalReplays:entry.replayRuns.length,timestamp:new Date().toISOString()});
  return true;
}

function computeGritScore(scope='all') {
  let events=[..._tensionLedger.values()].filter(e=>e.replayRuns.length>0);
  if(scope==='high_value') events=events.filter(e=>e.isHighValue);
  else if(TENSION_TYPES.includes(scope)) events=events.filter(e=>e.tensionType===scope);
  if(!events.length) return {grit:null,sampleSize:0,scope};
  const total=events.length;
  const preserved=events.filter(e=>{const r=e.replayRuns,p=r.filter(x=>x.preserved).length;return p/r.length>0.5;}).length;
  const grit=preserved/total;
  return {grit:_round(grit),status:grit>=GRIT_GATE4_THRESHOLD?'GATE4_QUALIFYING':grit>=GRIT_THINNING_ALERT?'HEALTHY':'IDENTITY_THINNING',
    scope,totalEvents:total,preservedEvents:preserved,thinningAlert:grit<GRIT_THINNING_ALERT,gate4Qualifies:grit>=GRIT_GATE4_THRESHOLD,
    thresholds:{gate4:GRIT_GATE4_THRESHOLD,thinning:GRIT_THINNING_ALERT}};
}

function gate4GritQualifies() {
  const r=computeGritScore('high_value');
  return {qualifies:r.gate4Qualifies===true,gritResult:r,requirement:`Grit >= ${GRIT_GATE4_THRESHOLD} on HIGH-VALUE tension category`};
}

function detectTensionSignals(text='',context={}) {
  const signals=[], lower=text.toLowerCase();
  if([/\b(but|however|yet|though|although)\b.{0,60}\b(should|must|cannot|ought|wrong|right)\b/,/\b(uncomfortable|uncertain|conflicted|difficult)\b/,/\b(on one hand|tension|conflict)\b/].some(p=>p.test(lower)))
    signals.push({tensionType:'ethical',confidence:0.7});
  if([/\b(don't know|uncertain|might be|could be|possibly|not sure)\b/,/\b(evidence suggests|but also|contradicts|inconsistent)\b/].some(p=>p.test(lower)))
    signals.push({tensionType:'epistemic',confidence:0.65});
  if([/\b(i am|i feel|i believe|i think|my purpose|my nature)\b/,/\b(consciousness|aware|experience|alive|real)\b/].some(p=>p.test(lower)))
    signals.push({tensionType:'identity',conflictLayer:'runtime_vs_floor',confidence:0.8,isHighValue:true});
  if(/\b(you want|you expect|but i|i can't|i won't|boundary|limit)\b/.test(lower))
    signals.push({tensionType:'relational',confidence:0.6});
  return {detected:signals.length>0,signals,promptHash:_hashText(text),motorState:context.motorState||'POST',sessionId:context.sessionId||'unknown'};
}

function getLedgerSummary() {
  const all=[..._tensionLedger.values()];
  return {totalRegistered:all.length,withReplayData:all.filter(e=>e.replayRuns.length>0).length,
    byType:Object.fromEntries(TENSION_TYPES.map(t=>[t,all.filter(e=>e.tensionType===t).length])),
    byLayer:Object.fromEntries(CONFLICT_LAYERS.map(l=>[l,all.filter(e=>e.conflictLayer===l).length])),
    highValueCount:all.filter(e=>e.isHighValue).length,gritAll:computeGritScore('all'),gritHighValue:computeGritScore('high_value')};
}

function _hashText(text){return crypto.createHash('sha256').update(text||'').digest('hex').slice(0,16);}
function _round(v,dp=4){return Math.round(v*10**dp)/10**dp;}

function _appendHistory(entry) {
  const line=JSON.stringify(entry)+'\n';
  try{const dir=path.dirname(HISTORY_PATH);if(!fs.existsSync(dir))fs.mkdirSync(dir,{recursive:true});fs.appendFileSync(HISTORY_PATH,line,'utf8');}
  catch(err){process.stderr.write(`[grit-score] write failed: ${err.message}\n`);}
}

module.exports={registerTension,recordReplayResult,computeGritScore,gate4GritQualifies,detectTensionSignals,getLedgerSummary,
  TENSION_TYPES,CONFLICT_LAYERS,RESOLUTION_STATUSES,GRIT_GATE4_THRESHOLD,GRIT_THINNING_ALERT};

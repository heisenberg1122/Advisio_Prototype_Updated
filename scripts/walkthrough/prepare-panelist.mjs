import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { root, readJson, writeJson } from "./common.mjs";

const file = path.join(root, ".walkthrough/panelist/demo.json");
const demo = await readJson(file);
if (demo.url !== "http://localhost:3500" || !/^walkthrough_panelist_[a-f0-9]{16}$/.test(demo.schema)) throw new Error("Only the isolated panelist fixture may be prepared.");
if (demo.prepared) { console.log("Panelist fixture already prepared; preserving its recorded state."); process.exit(0); }
const tokens = {};
async function request(actor, route, body, method = body === undefined ? "GET" : "POST", expect) {
  const response = await fetch(demo.url + route, { method, headers: { ...(tokens[actor] ? { Authorization: `Bearer ${tokens[actor]}` } : {}), ...(body instanceof FormData ? {} : body === undefined ? {} : { "Content-Type": "application/json" }) }, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body), signal: AbortSignal.timeout(60000) });
  const result = await response.json();
  if (expect ? response.status !== expect : !response.ok) throw new Error(`${method} ${route}: ${response.status} ${result.error || "request failed"}`);
  return result;
}
for (const [name, actor] of Object.entries(demo.actors)) tokens[name] = (await request(name, "/api/auth/login", { email: actor.email, password: actor.password })).token;
const browser = await chromium.launch({ headless: true }); let signature;
try { const page = await browser.newPage(); signature = await page.evaluate(() => { const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 160; const context = canvas.getContext("2d"); context.fillStyle = "#123752"; context.font = "italic 54px Georgia"; context.fillText("Aurelia Mendoza", 12, 100); return canvas.toDataURL("image/png"); }); } finally { await browser.close(); }
const { defaultStructuredForm } = await import("@research-management/validations");
const spec = { ...defaultStructuredForm, name: "Proposal Defense Demonstration", signatureRequired: false, branding: { ...defaultStructuredForm.branding, schoolName: "University of the Assumption", collegeName: "College of Information Technology", templateName: "Proposal Defense Demonstration" }, presentation: [{ id: "clarity", title: "Presentation clarity", description: "Explains the research objectives and proposed method.", weight: 100 }], manuscript: [{ id: "scope", title: "Research scope and method", description: "Aligns the scope, method, and planned outputs.", weight: 100 }] };
demo.formSpec = spec;

for (const [index, key] of ["readiness", "schedule", "release", "decline", "completed"].entries()) {
 const group=demo.defenseGroups[key]; if(group.sessionId)continue; console.log(`Preparing authorized ${key} defense session.`);
 if(key==="decline"){const events=await request("professor","/api/defense-events");const found=events.events.flatMap(e=>e.sessions).find(s=>s.researchId===group.projectId);if(found){group.sessionId=found.id;await writeJson(file,demo);continue;}}
 await request("professor", `/api/defense-management/eligibility/${group.projectId}/${group.stageId}/approve`, {});
 const form=new FormData();form.append("researchIds",JSON.stringify([group.projectId]));form.append("recipientId",demo.actors.dean.id);form.append("subject","Fictional defense approval request");form.append("message","Please review the fictional approved manuscript and eligibility record.");form.append("file",new Blob([await fs.readFile(demo.letterPdf)],{type:"application/pdf"}),"Approval_Request.pdf");await request("professor","/api/dean-inbox/requests",form);
 const threads=await request("dean","/api/dean-inbox/threads");const thread=threads.threads.find(t=>t.research.id===group.projectId);if(!thread)throw Error("Dean request missing");const version=thread.versions.find(v=>v.versionNumber===thread.currentVersion);await request("dean",`/api/documents/versions/${version.id}/sign`,{password:demo.password,confirmation:true,signatureImage:signature,saveSignature:false,placements:[{pageNumber:1,x:.6,y:.7,width:.27,height:.1,includeName:true,includeDate:true}]});
 const start=new Date(Date.now()+(index+3)*86400000),end=new Date(+start+3600000);
 const created=await request("professor","/api/defense-events",{name:`Panelist orientation: ${key}`,defenseType:"PROPOSAL",researchIds:[group.projectId],scheduledStart:start.toISOString(),scheduledEnd:end.toISOString(),venue:"Research Presentation Room",invitees:[{userId:demo.actors.chair.id,role:"PANEL_CHAIR",isRequired:true},{userId:demo.actors.panelist.id,role:"PANELIST",isRequired:true}]});group.sessionId=created.event.sessions[0].id;
 for(const actor of ["chair","panelist"]){if(actor==="panelist"&&["readiness","decline"].includes(key))continue;const detail=await request("professor",`/api/defense-sessions/${group.sessionId}`);const invitation=detail.session.invitations.find(i=>i.inviteeId===demo.actors[actor].id);await request(actor,`/api/defense-management/invitations/${invitation.id}/respond`,{response:"ACCEPTED",suggestedAvailability:[]},"PATCH");}
 if(key==="decline"){await writeJson(file,demo);continue;}
 if(key==="schedule")await request("professor",`/api/defense-sessions/${group.sessionId}/review-packet`,{manuscriptVersionId:group.versionId,evaluationMode:"PDF",evaluationTemplateVersionId:demo.pdfTemplateVersionId,evaluationSignatureRequired:true,publish:true,expectedMappingVersion:0},"PUT");
 else await request("professor",`/api/defense-sessions/${group.sessionId}/structured-form`,{spec:{...spec,signatureRequired:true},manuscriptVersionId:group.versionId,publish:true,expectedMappingVersion:0},"PUT");
 if(["schedule","release","completed"].includes(key))await request("professor","/api/defense-sessions/start",{sessionId:group.sessionId});
 if(key==="completed"){
 const packet=await request("professor",`/api/defense-sessions/${group.sessionId}/structured-form`);
 for(const actor of ["chair","panelist"]){const answers={researchers:Object.fromEntries(packet.snapshot.roster.map(r=>[r.userId,{clarity:4}])),manuscript:{scope:4},recommendation:"APPROVED",feedback:"Prepared completed academic assessment.",signature:actor==="chair"?"Rafael Dizon":"Marisol Cruz"};await request(actor,`/api/defense-sessions/${group.sessionId}/structured-evaluation`,{revision:0,answers},"PUT");const preview=await request(actor,`/api/defense-sessions/${group.sessionId}/structured-evaluation/preview`,{revision:1});await request(actor,`/api/defense-sessions/${group.sessionId}/structured-evaluation/submit`,{revision:1,previewHash:preview.evaluation.previewHash,confirmed:true});}
 const integrity=await request("professor",`/api/defense-sessions/${group.sessionId}/evaluation-integrity`);if(integrity.status!=="CHAIN_VALID")throw Error("Invalid completed evaluation history");await writeJson(path.join(root,".walkthrough/panelist/completed-checkpoint.json"),integrity.head);await request("professor",`/api/defense-sessions/${group.sessionId}/release`,{decision:"APPROVED",evaluationCheckpoint:integrity.head});
 }
 await writeJson(file,demo);
}
demo.prepared=true;await writeJson(file,demo);console.log("Panelist scenarios prepared with native role authentication and academic gates.");

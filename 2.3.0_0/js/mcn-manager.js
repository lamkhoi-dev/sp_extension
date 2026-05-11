(()=>{(()=>{let x="https://affiliate.shopee.vn/api/v3/gql/",b="1",T=n=>{var e;return(e=document.cookie.split("; ").find(o=>o.startsWith(n+"=")))==null?void 0:e.split("=")[1]};function R(n={}){let e=T("csrftoken"),o={"content-type":"application/json",accept:"application/json, text/plain, */*","affiliate-program-type":b,...n};return e&&!o["csrf-token"]&&(o["csrf-token"]=decodeURIComponent(e)),o}async function m(n,e,o={},r=!0){var d,l,s;let c=r?`${x}?q=${encodeURIComponent(n)}`:x,t=await fetch(c,{method:"POST",headers:R(),body:JSON.stringify({operationName:n,query:e,variables:o}),credentials:"include"}),i=await t.text(),a;try{a=JSON.parse(i)}catch{a={raw:i}}if(!t.ok||(d=a==null?void 0:a.errors)!=null&&d.length)throw console.error("GQL ERROR:",{status:t.status,json:a}),new Error(((s=(l=a==null?void 0:a.errors)==null?void 0:l[0])==null?void 0:s.message)||`HTTP ${t.status}`);return a}let v=n=>`
      query ${n}($pagination: MCNPaginationInput){
        ${n}(pagination:$pagination){
          invitationDetailList{
            mcnBasicInfo{ mcnId mcnName mcnLogo }
            invitationDetail{
              requestId
              requestType
              requestStatus
              createTime
              operatorType
              expiredTime
              oldMcnFeeRatePercent
              newMcnFeeRatePercent
              oldPeriodStartTime
              oldPeriodEndTime
              newPeriodEndTime
              newPeriodStartTime
              reason
              displayLeftExpiredDays
            }
          }
          pagination{ pageNum pageSize totalCount }
        }
      }
    `,N=n=>`
      query ${n}{
        ${n}{
          partnershipDetail{
            mcnId affiliateId partnershipId mcnFeeRatePercent
            startDateTimestamp endDateTimestamp isExpiredSoon
            cancellationStatus displayPartnershipLeftExpiredDays
          }
          pendingRequest{
            requestId requestType requestStatus createTime operatorType expiredTime
            oldMcnFeeRatePercent newMcnFeeRatePercent
            oldPeriodStartTime oldPeriodEndTime
            newPeriodEndTime newPeriodStartTime
            reason displayLeftExpiredDays
          }
          mcnBasicInfo{ mcnId mcnName mcnLogo }
        }
      }
    `,q=n=>`
      mutation ${n}($mcnId:Long,$requestId:Long,$requestType:RequestType,$isAccept:Boolean){
        ${n}(mcnId:$mcnId,requestId:$requestId,requestType:$requestType,isAccept:$isAccept){
          isSuccess
        }
      }
    `,g=(n,e="#00ff9c")=>console.log(`%c ${n} `,`background:#111;color:${e};padding:6px 12px;border-radius:6px;font-weight:700`),p=n=>{if(n==null)return"";let e=Number(n);return Number.isFinite(e)?new Date(e*1e3).toLocaleString():""};async function f({mcnId:n,requestId:e,requestType:o,isAccept:r}){var d,l;let c="mcnKOLReplyToMCNRequest",t={mcnId:String(n),requestId:String(e),requestType:o,isAccept:!!r},i=await m(c,q(c),t,!1),a=(l=(d=i==null?void 0:i.data)==null?void 0:d[c])==null?void 0:l.isSuccess;return g(`\u2705 ${r?"ACCEPT":"REJECT"} ${o} -> ${a?"SUCCESS":"FAILED"}`,a?"#00ff9c":"#ff4d6d"),a}async function h(n="1",e="20"){var d;let o="mcnPendingPartnershipInvitationList",r={pagination:{pageNum:String(n),pageSize:String(e)}},t=(await m(o,v(o),r,!0)).data[o],i=(t==null?void 0:t.invitationDetailList)||[];if(g("MCN INVITATIONS (Pending)"),!i.length)return console.log("No pending invitations."),{raw:t,rows:[]};let a=i.map(l=>{let s=l.invitationDetail,y=l.mcnBasicInfo;return{"MCN Name":y.mcnName,"MCN ID":y.mcnId,"Request ID":s.requestId,Status:s.requestStatus,"Old Fee %":s.oldMcnFeeRatePercent,"New Fee %":s.newMcnFeeRatePercent,Created:p(s.createTime),Expire:p(s.expiredTime),"Days Left":s.displayLeftExpiredDays,Reason:s.reason,__action:{mcnId:y.mcnId,requestId:s.requestId,requestType:"InvitationRequest"}}});return console.table(a.map(({__action:l,...s})=>s)),console.log(`%c Total: ${((d=t.pagination)==null?void 0:d.totalCount)||"0"} invitation(s)`,"color:#ffd166;font-weight:bold"),{raw:t,rows:a}}async function w(){let n="mcnOngoingPartnershipDetailAndPendingRequest",o=(await m(n,N(n),{},!0)).data[n],r=o==null?void 0:o.pendingRequest,c=o==null?void 0:o.mcnBasicInfo,t=o==null?void 0:o.partnershipDetail;if(g("MCN PARTNERSHIP & PENDING REQUEST"),t&&t.mcnId){let i={"MCN Name":c==null?void 0:c.mcnName,"MCN ID":t.mcnId,"Affiliate ID":t.affiliateId,"Partnership ID":t.partnershipId,"Fee %":t.mcnFeeRatePercent,"Start Date":p(t.startDateTimestamp),"End Date":p(t.endDateTimestamp),"Days Left":t.displayPartnershipLeftExpiredDays,"Expiring Soon":t.isExpiredSoon?"Yes":"No",Cancellation:t.cancellationStatus||"None"};console.log("%c \u2501\u2501\u2501 CURRENT PARTNERSHIP \u2501\u2501\u2501","color:#00d9ff;font-weight:bold;font-size:14px"),console.table([i])}else console.log("%c No active partnership.","color:#ff9f1c;font-weight:bold");if(r&&r.requestId){let i={"Request ID":r.requestId,Type:r.requestType,Status:r.requestStatus,"Old Fee %":r.oldMcnFeeRatePercent,"New Fee %":r.newMcnFeeRatePercent,Created:p(r.createTime),Expire:p(r.expiredTime),"Days Left":r.displayLeftExpiredDays,Reason:r.reason};console.log("%c \u2501\u2501\u2501 PENDING REQUEST \u2501\u2501\u2501","color:#ffd60a;font-weight:bold;font-size:14px"),console.table([i])}else console.log("%c No pending extended request.","color:#ff9f1c;font-weight:bold");return{raw:o,partnership:t,pendingRequest:r}}function P(){let n="addlivetag-mcn-panel",e=document.getElementById(n);return e||(e=document.createElement("div"),e.id=n,e.style.cssText=`
        position:fixed; right:16px; bottom:16px; z-index:999999;
        width:380px; max-height:70vh; overflow:auto;
        background:#0b0b0f; color:#eaeaea; border:1px solid #2a2a33;
        border-radius:12px; box-shadow:0 8px 30px rgba(0,0,0,.35);
        font:12px/1.4 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto;
      `,e.innerHTML=`
        <div style="padding:12px 12px 10px; display:flex; gap:8px; align-items:center; justify-content:space-between; border-bottom:1px solid #20202a;">
          <div style="font-weight:800;">MCN Tools</div>
          <div style="display:flex; gap:6px;">
            <button data-act="refresh" style="cursor:pointer;border:1px solid #2a2a33;background:#151520;color:#fff;padding:6px 10px;border-radius:10px;">Refresh</button>
            <button data-act="close" style="cursor:pointer;border:1px solid #2a2a33;background:#151520;color:#fff;padding:6px 10px;border-radius:10px;">Close</button>
          </div>
        </div>
        <div id="addlivetag-mcn-body" style="padding:10px 12px;"></div>
        <div style="padding:10px 12px; border-top:1px solid #20202a; opacity:.75;">
          Tip: m\u1EDF Console \u0111\u1EC3 xem log chi ti\u1EBFt. Code by Addlivetag.com
        </div>
      `,document.body.appendChild(e),e.querySelector('[data-act="close"]').onclick=()=>e.remove(),e.querySelector('[data-act="refresh"]').onclick=()=>window.addlivetagMCN.refresh(),e)}function u(n,e,o,r=[],c=!1){let t=document.createElement("div"),i=c?"#0a1f2e":"#101019",a=c?"#1a4d6f":"#2a2a33";t.style.cssText=`
        border:1px solid ${a}; border-radius:12px; padding:10px; margin-bottom:10px;
        background:${i};
      `,t.innerHTML=`
        <div style="font-weight:800; margin-bottom:2px;">${e}</div>
        <div style="opacity:.8; margin-bottom:8px;">${o||""}</div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;"></div>
      `;let d=t.querySelector("div:last-child");r.forEach(l=>{let s=document.createElement("button");s.textContent=l.label,s.style.cssText=`
          cursor:pointer; border:1px solid #2a2a33; background:#151520; color:#fff;
          padding:7px 10px; border-radius:10px;
        `,s.onclick=l.onClick,d.appendChild(s)}),n.appendChild(t)}async function I(){var o,r;let e=P().querySelector("#addlivetag-mcn-body");e.innerHTML='<div style="opacity:.8;">Loading...</div>';try{let c=await h("1","20"),t=await w();if(e.innerHTML="",t.partnership&&t.partnership.mcnId){let i=t.partnership,a=(o=t.raw)==null?void 0:o.mcnBasicInfo,d=i.displayPartnershipLeftExpiredDays,l=i.isExpiredSoon,s=`
                    Fee: ${i.mcnFeeRatePercent}% \u2022 
                    ${p(i.startDateTimestamp)} \u2192 ${p(i.endDateTimestamp)}<br/>
                    ${l?"\u26A0\uFE0F ":""}C\xF2n ${d} ng\xE0y
                `;u(e,`\u{1F4CA} Partnership: ${(a==null?void 0:a.mcnName)||"N/A"}`,s,[],!0)}else u(e,"\u{1F4CA} Partnership Info","Ch\u01B0a c\xF3 MCN \u0111ang li\xEAn k\u1EBFt.",[],!0);if(c.rows.length?c.rows.forEach(i=>{let a=i.__action;u(e,`\u{1F4E8} Invitation: ${i["MCN Name"]} (${i["New Fee %"]}% fee)`,`Req #${i["Request ID"]} \u2022 Expire: ${i.Expire} \u2022 Left: ${i["Days Left"]} day(s)`,[{label:"\u2705 Accept",onClick:async()=>{await f({...a,isAccept:!0}),await window.addlivetagMCN.refresh()}},{label:"\u274C Reject",onClick:async()=>{await f({...a,isAccept:!1}),await window.addlivetagMCN.refresh()}}])}):u(e,"\u{1F4E8} Invitations","Kh\xF4ng c\xF3 l\u1EDDi m\u1EDDi pending.",[]),t.pendingRequest&&t.pendingRequest.requestId){let i=t.pendingRequest,a=(r=t.raw)==null?void 0:r.mcnBasicInfo,d={mcnId:a==null?void 0:a.mcnId,requestId:i.requestId,requestType:"ExtendedRequest"};u(e,`\u{1F504} Extended: ${a==null?void 0:a.mcnName} (${i.newMcnFeeRatePercent}% fee)`,`Req #${i.requestId} \u2022 Expire: ${p(i.expiredTime)} \u2022 Left: ${i.displayLeftExpiredDays} day(s)`,[{label:"\u2705 Accept",onClick:async()=>{await f({...d,isAccept:!0}),await window.addlivetagMCN.refresh()}},{label:"\u274C Reject",onClick:async()=>{await f({...d,isAccept:!1}),await window.addlivetagMCN.refresh()}}])}else u(e,"\u{1F504} Extended Request","Kh\xF4ng c\xF3 y\xEAu c\u1EA7u gia h\u1EA1n pending.",[])}catch(c){e.innerHTML=`<div style="color:#ff4d6d;font-weight:700;">Error: ${String(c.message||c)}</div>`,console.error(c)}}window.addlivetagMCN={mcnPendingPartnershipInvitationList:h,mcnOngoingPartnershipDetailAndPendingRequest:w,replyToRequest:f,showPanel:I,refresh:I},g("addlivetagMCN script loaded","#7aa2ff"),console.log("Run UI panel: addlivetagMCN.showPanel()"),console.log("Run only invitations: addlivetagMCN.mcnPendingPartnershipInvitationList()"),console.log("Run only partnership/extended: addlivetagMCN.mcnOngoingPartnershipDetailAndPendingRequest()"),addlivetagMCN.showPanel()})();})();

(()=>{function g(e,...t){}function v(e,...t){}var _=!1,L=null,E=!1,re=null,B=null,m=null,D=null,O=!1,F=!1,f={widgetIcon:null,widgetPanel:null,affiliateLinkIcon:null,affiliateLinkPanel:null,getWidgetIcon:()=>(f.widgetIcon||(f.widgetIcon=document.getElementById("shopee-commission-widget-icon")),f.widgetIcon),getWidgetPanel:()=>(f.widgetPanel||(f.widgetPanel=document.getElementById("shopee-commission-widget-panel")),f.widgetPanel),getAffiliateLinkIcon:()=>(f.affiliateLinkIcon||(f.affiliateLinkIcon=document.getElementById("shopee-link-widget-icon")),f.affiliateLinkIcon),getAffiliateLinkPanel:()=>(f.affiliateLinkPanel||(f.affiliateLinkPanel=document.getElementById("shopee-link-widget-panel")),f.affiliateLinkPanel),clear:()=>{f.widgetIcon=null,f.widgetPanel=null,f.affiliateLinkIcon=null,f.affiliateLinkPanel=null}},T=null,A=null,R=[];function y(){let e=new URL(window.location.href),t=e.pathname.match(/\/product\/(\d+)\/(\d+)/);if(t&&t.length>2){let l=t[1];return t[2]}let o=e.pathname.match(/-i\.(\d+)\.(\d+)/);if(o&&o.length>2){let l=o[1];return o[2]}let i=e.search.match(/-i\.(\d+)\.(\d+)/);if(i&&i.length>2){let l=i[1];return i[2]}return null}async function P(){return(await chrome.storage.local.get("autoCheckCommission")).autoCheckCommission!==!1}function se(e){return new Promise((t,o)=>{chrome.runtime.sendMessage({type:"GET_PRODUCT_COMMISSION",itemId:e},i=>{chrome.runtime.lastError?o(new Error(chrome.runtime.lastError.message)):i&&i.success?t(i.data):o(new Error((i==null?void 0:i.error)||"Unknown error"))})})}function le(e){return e?new Date(e.replace(" ","T")+"Z").toLocaleString("vi-VN",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"}):"N/A"}function S(e){return e==null||isNaN(e)?"0 \u20AB":new Intl.NumberFormat("vi-VN",{style:"currency",currency:"VND",minimumFractionDigits:0}).format(e)}function W(){if(f.getWidgetIcon())return;let e=document.createElement("div");e.id="shopee-commission-widget-icon",e.innerHTML="\u{1F4B0}",e.style.cssText=`
        position: fixed;
        bottom: 60px;
        right: 20px;
        width: 50px;
        height: 50px;
        background: #ee4d2d;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        cursor: pointer;
        z-index: 999999;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        transition: transform 0.2s, opacity 0.2s;
        opacity: 0.8;
        transition: opacity 0.2s;
        &:hover {
            opacity: 1;
        }
    `,e.addEventListener("mouseenter",()=>{e.style.transform="scale(1.1)",e.style.opacity="1"}),e.addEventListener("mouseleave",()=>{e.style.transform="scale(1)",e.style.opacity="0.5"}),e.addEventListener("click",()=>{H()}),document.body.appendChild(e)}function X(){if(f.getWidgetPanel())return;let e=document.createElement("div");e.id="shopee-commission-widget-panel",e.style.cssText=`
        position: fixed;
        bottom: 60px;
        right: 80px;
        width: 350px;
        max-height: 500px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        z-index: 999998;
        display: none;
        overflow-y: auto;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `,e.innerHTML=`
        <div style="padding: 0.5rem; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin: 0; font-size: 16px; color: #ee4d2d;">L\u1ECBch s\u1EED b\xE1n h\xE0ng</h3>
            <button id="widget-close-btn" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #999;">\xD7</button>
        </div>
        <div id="widget-content" style="padding: 0.5rem; max-height: 400px; overflow-y: auto;">
            <div style="text-align: center; padding: 20px; color: #999;">\u0110ang t\u1EA3i...</div>
        </div>
    `,document.body.appendChild(e),document.getElementById("widget-close-btn").addEventListener("click",()=>{H()})}function H(){let e=f.getWidgetPanel();e&&(_=!_,e.style.display=_?"block":"none",_&&U())}function x(e){let t=f.getWidgetIcon();t&&(e?t.style.display="flex":t.style.display="none")}function j(e){if(!e){x(!1);return}chrome.runtime.sendMessage({type:"CALCULATE_PRODUCT_STATS",productId:e},t=>{if(chrome.runtime.lastError){x(!1);return}if(t&&t.success&&t.stats){let o=t.stats.totalOrders>0;x(o)}else x(!1)})}async function U(){let e=y();if(!e){document.getElementById("widget-content").innerHTML=`
            <div style="text-align: center; padding: 20px; color: #999;">
                Kh\xF4ng t\xECm th\u1EA5y ID s\u1EA3n ph\u1EA9m
            </div>
        `,x(!1);return}L=e,chrome.runtime.sendMessage({type:"CALCULATE_PRODUCT_STATS",productId:e},t=>{if(chrome.runtime.lastError){document.getElementById("widget-content").innerHTML=`
                <div style="text-align: center; padding: 20px; color: #f00;">
                    L\u1ED7i: ${chrome.runtime.lastError.message}
                </div>
            `,x(!1);return}if(t&&t.success){console.log("Response:",t),ce(t.stats);let o=t.stats&&t.stats.totalOrders>0;x(o)}else document.getElementById("widget-content").innerHTML=`
                <div style="text-align: center; padding: 20px; color: #999;">
                    ${(t==null?void 0:t.error)||"Kh\xF4ng c\xF3 d\u1EEF li\u1EC7u"}
                </div>
            `,x(!1)})}function ce(e){var o,i,l,n,s,r;if(!e||e.totalOrders===0){document.getElementById("widget-content").innerHTML=`
            <div style="text-align: center; padding: 20px; color: #999;">
                Ch\u01B0a c\xF3 d\u1EEF li\u1EC7u b\xE1n h\xE0ng cho s\u1EA3n ph\u1EA9m n\xE0y
            </div>
        `,x(!1);return}let t=`
        <div style="padding: 10px; font-family: Arial, sans-serif;">
            <div style="margin-bottom: 10px;">
                <span style="font-size: 14px; color: #555;">T\u1ED5ng s\u1ED1 \u0111\u01A1n:</span>
                <span style="font-size: 18px; font-weight: bold; color: #ee4d2d;">${e.totalOrders}</span>
            </div>
            
            <div style="margin-bottom: 10px;">
                <span style="font-size: 14px; color: #555;">Doanh s\u1ED1:</span>
                <span style="font-size: 16px; font-weight: bold; color: #333;">${((o=e.formatted)==null?void 0:o.totalGMV)||"0 \u20AB"}</span>
            </div>
            
            <div style="margin-bottom: 10px;">
                <span style="font-size: 14px; color: #555;">Hoa h\u1ED3ng:</span>
                <span style="font-size: 16px; font-weight: bold; color: #333;">${((i=e.formatted)==null?void 0:i.totalCommission)||"0 \u20AB"}</span>
            </div>
            
            ${e.lastOrderDate?`<div style="font-size: 14px; color: #555;">\u0110\u01A1n g\u1EA7n nh\u1EA5t: ${e.lastOrderDate}, Gi\xE1 tr\u1ECB \u0111\u01A1n: <span style="font-weight: bold; color: #ee4d2d;">${((l=e.formatted)==null?void 0:l.lastOrderAmount)||"0 \u20AB"}</span></div>`:""}
            
            <div style="margin-top: 10px; border-top: 1px solid #ddd; padding-top: 10px;">
                <span style="font-size: 14px; color: #555;">K\xEAnh b\xE1n h\xE0ng:</span>
                <div style="display: flex; gap: 8px; margin-top: 5px;">
                    <span style="padding: 4px 6px; background: #e3f2fd; border-radius: 3px; color: #1976d2; font-size: 12px;">
                        Video: ${((n=e.channels)==null?void 0:n.video)||0}
                    </span>
                    <span style="padding: 4px 6px; background: #fff3e0; border-radius: 3px; color: #f57c00; font-size: 12px;">
                        Live: ${((s=e.channels)==null?void 0:s.live)||0}
                    </span>
                    <span style="padding: 4px 6px; background: #f3e5f5; border-radius: 3px; color: #7b1fa2; font-size: 12px;">
                        MXH: ${((r=e.channels)==null?void 0:r.social)||0}
                    </span>
                </div>
            </div>
        </div>
    `;document.getElementById("widget-content").innerHTML=t}async function C(e,t=0){var s,r;if(!e){g("Kh\xF4ng c\xF3 productId");return}if((await chrome.storage.local.get("priceHistoryEnabled")).priceHistoryEnabled===!1){g("L\u1ECBch s\u1EED gi\xE1 \u0111\xE3 b\u1ECB t\u1EAFt trong c\xE0i \u0111\u1EB7t");return}let i=5,l=2e3;if(t>=i){g(`Kh\xF4ng t\xECm th\u1EA5y ph\u1EA7n gi\xE1 sau ${i} l\u1EA7n th\u1EED`);return}if(document.readyState!=="complete"){window.addEventListener("load",()=>{setTimeout(()=>C(e,t),1e3)});return}let n=ae();if(!n){t<i&&(g(`Retry ${t+1}/${i}...`),setTimeout(()=>C(e,t+1),l));return}m&&(m.remove(),m=null),m=de(),n.parentNode.insertBefore(m,n.nextSibling);try{if(g("\u0110ang fetch d\u1EEF li\u1EC7u cho productId:",e),typeof SERVER_CONFIG>"u"||!((s=SERVER_CONFIG.priceTracking)!=null&&s.endpoint))throw g("Ch\u01B0a c\u1EA5u h\xECnh server URL"),new Error("Ch\u01B0a c\u1EA5u h\xECnh server URL");let c=ie();c&&!c.item_id&&e&&(c.item_id=e);let a=((r=SERVER_CONFIG.priceTracking)==null?void 0:r.defaultDays)||90,d=await new Promise((p,u)=>{chrome.runtime.sendMessage({type:"FETCH_PRICE_TRACKING",itemId:e,days:a,currency:"VND",productData:c||void 0},h=>{chrome.runtime.lastError?u(new Error(chrome.runtime.lastError.message)):h&&h.success?p(h.data):u(new Error((h==null?void 0:h.error)||"Kh\xF4ng th\u1EC3 t\u1EA3i l\u1ECBch s\u1EED gi\xE1"))})});if(!d||!d.prices||d.prices.length===0){ue();return}g("\u0110\xE3 nh\u1EADn \u0111\u01B0\u1EE3c d\u1EEF li\u1EC7u:",d.prices.length,"\u0111i\u1EC3m"),pe(d,c==null?void 0:c.price)}catch(c){g("Error:",c),ge(c.message)}}function ae(){let e=[".jRlVo0",".IFdRIb",".IZPeQz",'section[aria-live="polite"]','[class*="price-container"]'];for(let o of e){let i=document.querySelectorAll(o);for(let l of i){let n=l.textContent||"";if(n.includes("\u20AB")||n.includes("\u0111")){let s=l,r=0;for(;s&&r<6;){if(s.tagName==="DIV"||s.tagName==="SECTION")return s;s=s.parentElement,r++}return l}}}let t=document.querySelectorAll("div, section");for(let o of t)if((o.textContent||"").match(/\d+[.,]\d+\s*₫/))return o.parentElement||o;return null}function de(){let e=document.createElement("div");return e.id="shopee-price-tracking-container",e.style.cssText=`
        display: none;
        margin-top: 0.5rem;
        padding: 0.5rem;
        padding-bottom: 0.25rem;
        padding-top: 0.25rem;
        background: #fff;
        border-radius: 8px;
        border: 1px solid #e5e5e5;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `,e}function pe(e,t=null){if(!m){g("Container kh\xF4ng t\u1ED3n t\u1EA1i");return}m.style.display="block";let o=formatPriceTrackingForChart(e),i=getPriceStats(e,t),l=`
        <div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
                <h3 style="margin: 0; font-size: 14px; font-weight: 400; color: #333; display: flex; align-items: center; gap: 8px;">
                    L\u1ECBch s\u1EED gi\xE1 c\u1EA3
                </h3>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <button id="price-chart-settings-btn" style="background: none; border: none; color: #999; cursor: pointer; padding: 4px;" title="G\u1EE1 c\xE0i \u0111\u1EB7t">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M6.5 2a.5.5 0 0 1 .5.5V3h2v-.5a.5.5 0 0 1 1 0V3h1.5A1.5 1.5 0 0 1 13 4.5v7A1.5 1.5 0 0 1 11.5 13h-7A1.5 1.5 0 0 1 3 11.5v-7A1.5 1.5 0 0 1 4.5 3H6V2.5a.5.5 0 0 1 .5-.5zM4.5 4a.5.5 0 0 0-.5.5v7a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.5-.5h-7z"/>
                            <path d="M6.354 6.354a.5.5 0 1 1 .707-.708l1 1 1-1a.5.5 0 1 1 .707.708l-1 1 1 1a.5.5 0 0 1-.707.707l-1-1-1 1a.5.5 0 0 1-.707-.707l1-1-1-1z"/>
                        </svg>
                    </button>
                    <button id="price-chart-expand" style="background: none; border: none; color: #999; cursor: pointer; padding: 4px;" title="Thu g\u1ECDn">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
        
        <div id="price-chart-content">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; margin-bottom: 0.5rem;">
                <div style="text-align: center; padding: 5px; background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); border-radius: 4px; border: 1px solid #90caf9;">
                    <div style="font-size: 0.5rem; color: #1565c0; margin-bottom: 2px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Th\u1EA5p nh\u1EA5t</div>
                    <div style="font-size: 0.8rem; font-weight: 700; color: #0d47a1;">${formatPrice(i.min_price)}</div>
                </div>
                <div style="text-align: center; padding: 5px; background: linear-gradient(135deg, #ffebee 0%, #ef9a9a 100%); border-radius: 4px; border: 1px solid #e57373;">
                    <div style="font-size: 0.5rem; color: #c62828; margin-bottom: 2px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Cao nh\u1EA5t</div>
                    <div style="font-size: 0.8rem; font-weight: 700; color: #b71c1c;">${formatPrice(i.max_price)}</div>
                </div>
                <div style="text-align: center; padding: 5px; background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%); border-radius: 4px; border: 1px solid #bdbdbd;">
                    <div style="font-size: 0.5rem; color: #424242; margin-bottom: 2px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Trung b\xECnh</div>
                    <div style="font-size: 0.8rem; font-weight: 700; color: #212121;">${formatPrice(i.avg_price)}</div>
                </div>
                <div style="text-align: center; padding: 5px; background: linear-gradient(135deg, #fff3e0 0%, #ffcc80 100%); border-radius: 4px; border: 1px solid #ffb74d;">
                    <div style="font-size: 0.5rem; color: #e65100; margin-bottom: 2px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Hi\u1EC7n t\u1EA1i</div>
                    <div style="font-size: 0.8rem; font-weight: 700; color: #e65100;">${formatPrice(i.current_price)}</div>
                </div>
            </div>
            
            <div style="height: 180px; position: relative; background: #fafafa; border-radius: 6px; padding: 0; margin-bottom: 8px;">
                <canvas id="shopee-price-tracking-chart" 
                    data-chart='${JSON.stringify(o).replace(/'/g,"&apos;")}' 
                    data-stats='${JSON.stringify(i).replace(/'/g,"&apos;")}'></canvas>
            </div>
            
            <div style="text-align: right; display: none;">
                <span style="font-size: 11px; color: #999;">Cung c\u1EA5p b\u1EDFi <strong style="color: #666;">Addlivetag</strong></span>
            </div>
        </div>
    `;m.innerHTML=l,fe(),requestAnimationFrame(()=>{setTimeout(()=>{J()},200)})}function fe(){let e=document.getElementById("price-chart-settings-btn");e&&e.addEventListener("click",()=>{chrome.runtime.sendMessage({type:"OPEN_OPTIONS_PAGE"},s=>{chrome.runtime.lastError&&g("L\u1ED7i khi m\u1EDF trang options:",chrome.runtime.lastError)})});let t=document.getElementById("price-chart-expand"),o=document.getElementById("price-chart-content"),i=!0;t&&o&&t.addEventListener("click",()=>{i=!i,o.style.display=i?"block":"none",t.innerHTML=i?'<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/></svg>':'<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M7.646 4.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 5.707l-5.646 5.647a.5.5 0 0 1-.708-.708l6-6z"/></svg>'});let l=document.getElementById("price-chart-period");l&&l.addEventListener("change",s=>{let r=parseInt(s.target.value);g("Thay \u0111\u1ED5i kho\u1EA3ng th\u1EDDi gian:",r,"ng\xE0y")});let n=document.getElementById("price-alert-btn");n&&(n.addEventListener("mouseenter",()=>{n.style.background="#ee4d2d",n.style.color="white"}),n.addEventListener("mouseleave",()=>{n.style.background="#fff",n.style.color="#ee4d2d"}),n.addEventListener("click",()=>{alert("T\xEDnh n\u0103ng theo d\xF5i gi\xE1 \u0111ang \u0111\u01B0\u1EE3c ph\xE1t tri\u1EC3n!")}))}function J(){if(g("B\u1EAFt \u0111\u1EA7u t\u1EA1o chart..."),!document.getElementById("shopee-price-tracking-chart")){g("\u274C Canvas kh\xF4ng t\u1ED3n t\u1EA1i!"),$("Canvas element kh\xF4ng t\xECm th\u1EA5y");return}if(g("\u2705 Canvas t\u1ED3n t\u1EA1i"),document.querySelector('script[src*="chart.min.js"]'))g("Chart.js \u0111\xE3 c\xF3"),q();else{g("\u0110ang inject Chart.js...");let o=document.createElement("script");o.src=chrome.runtime.getURL("js/chart.min.js"),o.onload=()=>{g("Chart.js loaded"),setTimeout(()=>{q()},500)},o.onerror=()=>{g("\u274C Kh\xF4ng load \u0111\u01B0\u1EE3c Chart.js"),$("Kh\xF4ng th\u1EC3 load Chart.js")},(document.head||document.documentElement).appendChild(o)}}function q(){g("Loading chart creation script...");let e=document.getElementById("shopee-price-tracking-chart");if(e){let i=e.hasAttribute("data-chart");g("Canvas has data attribute:",i)}if(document.querySelector('script[src*="price-chart-creator.js"]')){g("Script \u0111\xE3 load, trigger event..."),setTimeout(()=>{window.dispatchEvent(new CustomEvent("createPriceChartNow"))},100);return}let o=document.createElement("script");o.src=chrome.runtime.getURL("js/price-chart-creator.js"),o.onload=()=>{g("\u2705 Chart creation script loaded"),setTimeout(()=>{g("Dispatching createPriceChartNow event..."),window.dispatchEvent(new CustomEvent("createPriceChartNow"))},100)},o.onerror=()=>{g("\u274C Kh\xF4ng load \u0111\u01B0\u1EE3c chart creation script"),$("Kh\xF4ng th\u1EC3 load chart script")},(document.head||document.documentElement).appendChild(o)}function ue(){m&&(m.style.display="none",m.innerHTML=`
            <div style="text-align: center; color: #999; font-size: 0.85rem;">
                Ch\u01B0a c\xF3 d\u1EEF li\u1EC7u l\u1ECBch s\u1EED gi\xE1 cho s\u1EA3n ph\u1EA9m n\xE0y
            </div>
        `)}function ge(e){m&&(m.style.display="none",m.innerHTML=`
            <div style="text-align: center; padding: 20px; color: #f00; font-size: 14px;">
                \u26A0\uFE0F ${e||"Kh\xF4ng th\u1EC3 t\u1EA3i l\u1ECBch s\u1EED gi\xE1"}
            </div>
        `)}function $(e){if(m){m.style.display="none";let t=m.querySelector('div[style*="height: 300px"]');t&&(t.innerHTML=`
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #f44336; font-size: 14px; flex-direction: column; gap: 8px;">
                    <div>\u26A0\uFE0F ${e||"Kh\xF4ng th\u1EC3 hi\u1EC3n th\u1ECB bi\u1EC3u \u0111\u1ED3"}</div>
                    <div style="font-size: 12px; color: #999;">D\u1EEF li\u1EC7u th\u1ED1ng k\xEA v\u1EABn hi\u1EC3n th\u1ECB \u1EDF tr\xEAn</div>
                </div>
            `)}}typeof window<"u"&&(window.injectPriceTrackingChart=C,window.createPriceChart=J);g("Module loaded - CSP compliant version");function Y(){if(f.getAffiliateLinkIcon())return;let e=document.createElement("div");e.id="shopee-link-widget-icon",e.innerHTML="\u{1F517}",e.style.cssText=`
        position: fixed;
        bottom: 120px;
        right: 20px;
        width: 50px;
        height: 50px;
        background: #ee4d2d;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        cursor: pointer;
        z-index: 999999;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        opacity: 0.5;
        transition: transform 0.2s, opacity 0.2s;
    `,e.addEventListener("mouseenter",()=>{e.style.transform="scale(1.1)",e.style.opacity="1"}),e.addEventListener("mouseleave",()=>{e.style.transform="scale(1)",e.style.opacity="0.5"}),e.addEventListener("click",()=>{te()}),document.body.appendChild(e)}function Z(){if(f.getAffiliateLinkPanel())return;let e=document.createElement("div");e.id="shopee-link-widget-panel",e.style.cssText=`
        position: fixed;
        bottom: 60px;
        right: 80px;
        width: 400px;
        max-height: 600px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        z-index: 999998;
        display: none;
        overflow-y: auto;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `,e.innerHTML=`
        <div style="padding: 0.5rem; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin: 0; font-size: 16px; color: #ee4d2d;">T\u1EA1o link ti\u1EBFp th\u1ECB li\xEAn k\u1EBFt</h3>
            <button id="affiliate-link-widget-close-btn" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #999;">\xD7</button>
        </div>
        <div id="affiliate-link-widget-content" style="padding: 0.5rem;">
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-size: 14px; color: #555; font-weight: 500;">URL:</label>
                <input type="text" id="affiliate-link-url-input" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;" />
            </div>
            <div style="margin-bottom: 10px;">
                <label style="display: block; margin-bottom: 5px; font-size: 14px; color: #555; font-weight: 500;">Sub_id (t\xF9y ch\u1ECDn):</label>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                    <input type="text" id="affiliate-link-sub1" placeholder="Sub_id1" style="padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;" />
                    <input type="text" id="affiliate-link-sub2" placeholder="Sub_id2" style="padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;" />
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                    <input type="text" id="affiliate-link-sub3" placeholder="Sub_id3" style="padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;" />
                    <input type="text" id="affiliate-link-sub4" placeholder="Sub_id4" style="padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;" />
                </div>
                <input type="text" id="affiliate-link-sub5" placeholder="Sub_id5" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box;" />
            </div>
            <button id="affiliate-link-create-btn" style="width: 100%; padding: 10px; background: #ee4d2d; color: white; border: none; border-radius: 4px; font-size: 14px; font-weight: 500; cursor: pointer; margin-bottom: 10px;">T\u1EA1o link</button>
            <button id="affiliate-link-commission-detail-btn" style="width: 100%; padding: 10px; background: #f5f5f5; color: #555; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; font-weight: 500; cursor: pointer; margin-bottom: 10px;">Xem chi ti\u1EBFt hoa h\u1ED3ng</button>
            <div id="affiliate-link-result" style="display: none; margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee;">
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px; font-size: 14px; color: #555; font-weight: 500;">Short Link:</label>
                    <div style="display: flex; gap: 5px;">
                        <input type="text" id="affiliate-link-short-result" readonly style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; background: #f5f5f5;" />
                        <button id="affiliate-link-short-copy-btn" style="padding: 8px 15px; background: #4CAF50; color: white; border: none; border-radius: 4px; font-size: 13px; cursor: pointer;">Copy</button>
                    </div>
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px; font-size: 14px; color: #555; font-weight: 500;">Long Link:</label>
                    <div style="display: flex; gap: 5px;">
                        <input type="text" id="affiliate-link-long-result" readonly style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; background: #f5f5f5;" />
                        <button id="affiliate-link-long-copy-btn" style="padding: 8px 15px; background: #4CAF50; color: white; border: none; border-radius: 4px; font-size: 13px; cursor: pointer;">Copy</button>
                    </div>
                </div>
            </div>
            <div id="affiliate-link-error" style="display: none; margin-top: 10px; padding: 10px; background: #ffebee; color: #c62828; border-radius: 4px; font-size: 13px;"></div>
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee;">
                <button id="affiliate-link-history-btn" style="width: 100%; padding: 8px; background: #f5f5f5; color: #555; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; cursor: pointer; margin-bottom: 10px;">L\u1ECBch s\u1EED</button>
                <div id="affiliate-link-history-list" style="display: none; max-height: 200px; overflow-y: auto;"></div>
            </div>
        </div>
    `,document.body.appendChild(e),f.affiliateLinkPanel=e;let t=e.querySelector("#affiliate-link-widget-close-btn");if(t){let i=()=>te();t.addEventListener("click",i),R.push({element:t,event:"click",handler:i})}let o=document.getElementById("affiliate-link-url-input");o&&(o.value=window.location.href),me(),Q()}async function Q(){let e=document.getElementById("affiliate-link-commission-detail-btn");if(!e)return;await P()?e.textContent="Xem chi ti\u1EBFt hoa h\u1ED3ng":e.textContent="Xem nhanh hoa h\u1ED3ng"}function me(){let e=document.getElementById("affiliate-link-create-btn");e&&e.addEventListener("click",_e);let t=document.getElementById("affiliate-link-short-copy-btn");t&&t.addEventListener("click",()=>{let n=document.getElementById("affiliate-link-short-result");n&&K(n)});let o=document.getElementById("affiliate-link-long-copy-btn");o&&o.addEventListener("click",()=>{let n=document.getElementById("affiliate-link-long-result");n&&K(n)});let i=document.getElementById("affiliate-link-history-btn");i&&i.addEventListener("click",Ie);let l=document.getElementById("affiliate-link-commission-detail-btn");l&&l.addEventListener("click",async()=>{let n=y();if(n){let s=`https://affiliate.shopee.vn/offer/product_offer/${n}`;window.open(s,"_blank")}else k("Kh\xF4ng t\xECm th\u1EA5y ID s\u1EA3n ph\u1EA9m")})}function he(e){if(!e)return"";let t=S(e.commission||0);return`
        <div id="shopee-commission-badge" style="
            position: fixed;
            bottom: 180px;
            right: 1px;
            padding: 8px 12px;
            background: #ee4d2d;
            color: white;
            border-radius: 20px;
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            z-index: 999999;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            transition: transform 0.2s, opacity 0.2s;
            white-space: nowrap;
            opacity: 0.8;
            transition: opacity 0.2s;
            &:hover {
                opacity: 1;
            }
        ">
            ${e.isXtra?"\u{1F4B5}":"\u{1F4B0}"} ${t}
        </div>
    `}function ye(e){if(!e)return"";let t=S(e.commission||0),o=S(e.sellerComFinal||0),i=S(e.shopeeComFinal||0),l=e.isXtra?"C\xF3":"Kh\xF4ng",n=e.hasSellerCommission?"C\xF3":"Kh\xF4ng",s=e.hasShopeeCommission?"C\xF3":"Kh\xF4ng",r=e.isCapped?"C\xF3":"Kh\xF4ng",c=e.isCapped?S(e.cap||0):"N/A",a=le(e.lastUpdate);return`
        <div id="shopee-commission-info-display" style="
            position: fixed;
            bottom: 60px;
            right: 80px;
            width: 350px;
            max-height: 600px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 999997;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            overflow-y: auto;
        ">
            <div style="padding: 0.25rem 0.5rem; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; background: white; z-index: 1;">
                <h3 style="margin: 0; font-size: 0.875rem; color: #ee4d2d;">Th\xF4ng tin hoa h\u1ED3ng</h3>
                <button id="commission-info-close-btn" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #999;">\xD7</button>
            </div>
            <div style="padding: 0.5rem;">
                <div style="margin-bottom: 0.5rem;">
                    <div style="font-size: 0.75rem; color: #666; margin-bottom: 0.5rem;">T\u1ED5ng hoa h\u1ED3ng</div>
                    <div style="font-size: 1.25rem; font-weight: bold; color: #ee4d2d;">${t}</div>
                </div>
                
                <div style="margin-bottom: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #eee;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span style="font-size: 0.75rem; color: #666;">Hoa h\u1ED3ng Seller:</span>
                        <span style="font-size: 0.875rem; font-weight: 500;">${o}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span style="font-size: 0.75rem; color: #666;">Hoa h\u1ED3ng Shopee:</span>
                        <span style="font-size: 0.875rem; font-weight: 500;">${i}</span>
                    </div>
                </div>

                <div style="margin-bottom: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #eee;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span style="font-size: 0.75rem; color: #666;">Xtra:</span>
                        <span style="font-size: 0.875rem; font-weight: 500;">${l}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span style="font-size: 0.75rem; color: #666;">C\xF3 hoa h\u1ED3ng Seller:</span>
                        <span style="font-size: 0.875rem; font-weight: 500;">${n}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span style="font-size: 0.75rem; color: #666;">C\xF3 hoa h\u1ED3ng Shopee:</span>
                        <span style="font-size: 0.875rem; font-weight: 500;">${s}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span style="font-size: 0.75rem; color: #666;">B\u1ECB gi\u1EDBi h\u1EA1n (Capped):</span>
                        <span style="font-size: 0.875rem; font-weight: 500;">${r}</span>
                    </div>
                    ${e.isCapped?`
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span style="font-size: 0.75rem; color: #666;">Gi\u1EDBi h\u1EA1n:</span>
                        <span style="font-size: 0.875rem; font-weight: 500;">${c}</span>
                    </div>
                    `:""}
                </div>

                <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #eee;">
                    <div style="font-size: 0.75rem; color: #999;">
                        C\u1EADp nh\u1EADt l\u1EA7n cu\u1ED1i: ${a}
                    </div>
                </div>

                <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #eee;">
                    <button id="commission-info-affiliate-btn" style="width: 100%; padding: 0.5rem; background: #f5f5f5; color: #555; border: 1px solid #ddd; border-radius: 4px; font-size: 0.75rem; font-weight: 500; cursor: pointer;">Xem chi ti\u1EBFt hoa h\u1ED3ng</button>
                </div>
            </div>
        </div>
    `}function xe(e){ee();let t=he(e);if(!t)return;let o=document.createElement("div");o.innerHTML=t;let i=o.firstElementChild;document.body.appendChild(i),i.addEventListener("click",()=>{F?N():be(e)}),i.addEventListener("mouseenter",()=>{i.style.transform="scale(1.05)",i.style.opacity="0.9"}),i.addEventListener("mouseleave",()=>{i.style.transform="scale(1)",i.style.opacity="1"})}function ee(){let e=document.getElementById("shopee-commission-badge");e&&e.remove()}function be(e){N();let t=ye(e);if(!t)return;let o=document.createElement("div");o.innerHTML=t;let i=o.firstElementChild;document.body.appendChild(i),F=!0;let l=document.getElementById("commission-info-close-btn");l&&l.addEventListener("click",N);let n=document.getElementById("commission-info-affiliate-btn");n&&n.addEventListener("click",()=>{let s=y();if(s){let r=`https://affiliate.shopee.vn/offer/product_offer/${s}`;window.open(r,"_blank")}})}function N(){let e=document.getElementById("shopee-commission-info-display");e&&e.remove(),F=!1}function ve(e){xe(e)}function M(){ee(),N()}async function z(e){let t=y();if(!t){M();return}if(!O&&e){O=!0;try{let o=await se(t);o.status==="success"&&o.productInfo&&(y()===t?(D=o,ve(o.productInfo)):M())}catch(o){console.error("Error fetching commission:",o)}finally{O=!1}}}function ke(e,t=3e4){return new Promise((o,i)=>{let l=setTimeout(()=>{i(new Error("Request timeout. Vui l\xF2ng th\u1EED l\u1EA1i."))},t);chrome.runtime.sendMessage(e,n=>{if(clearTimeout(l),chrome.runtime.lastError){i(new Error(chrome.runtime.lastError.message));return}if(!n){i(new Error("Kh\xF4ng nh\u1EADn \u0111\u01B0\u1EE3c ph\u1EA3n h\u1ED3i t\u1EEB background script"));return}o(n)})})}async function _e(){var s,r,c,a,d;let e=document.getElementById("affiliate-link-url-input"),t=document.getElementById("affiliate-link-result"),o=document.getElementById("affiliate-link-error"),i=document.getElementById("affiliate-link-create-btn");if(!e||!t||!o||!i)return;o.style.display="none",t.style.display="none";let l=e.value.trim();if(!l){k("Vui l\xF2ng nh\u1EADp URL");return}if(!l.includes("shopee.vn")){k("URL ph\u1EA3i l\xE0 trang Shopee (shopee.vn)");return}let n={subId1:((s=document.getElementById("affiliate-link-sub1"))==null?void 0:s.value.trim())||"",subId2:((r=document.getElementById("affiliate-link-sub2"))==null?void 0:r.value.trim())||"",subId3:((c=document.getElementById("affiliate-link-sub3"))==null?void 0:c.value.trim())||"",subId4:((a=document.getElementById("affiliate-link-sub4"))==null?void 0:a.value.trim())||"",subId5:((d=document.getElementById("affiliate-link-sub5"))==null?void 0:d.value.trim())||""};i.disabled=!0,i.textContent="\u0110ang t\u1EA1o...";try{console.log("[Content] G\u1EEDi request CREATE_AFFILIATE_LINK:",l);let p=await ke({type:"CREATE_AFFILIATE_LINK",originalLink:l,subIds:n},6e3);if(console.log("[Content] Nh\u1EADn \u0111\u01B0\u1EE3c response:",p),p.success){let u=document.getElementById("affiliate-link-short-result"),h=document.getElementById("affiliate-link-long-result");u&&(u.value=p.shortLink||""),h&&(h.value=p.longLink||""),t.style.display="block",we({originalLink:l,subIds:n,shortLink:p.shortLink||"",longLink:p.longLink||""})}else{let u=p.error||"Kh\xF4ng th\u1EC3 t\u1EA1o link";u==="UNAUTHORIZED"&&(u="Vui l\xF2ng \u0111\u0103ng nh\u1EADp v\xE0o https://affiliate.shopee.vn tr\u01B0\u1EDBc"),k(u)}}catch(p){console.error("[Content] Error in handleCreateAffiliateLink:",p);let u=p.message||"\u0110\xE3 x\u1EA3y ra l\u1ED7i";u.includes("port closed")||u.includes("message port closed")?k("K\u1EBFt n\u1ED1i b\u1ECB \u0111\xF3ng. Vui l\xF2ng th\u1EED l\u1EA1i ho\u1EB7c ki\u1EC3m tra k\u1EBFt n\u1ED1i."):u.includes("timeout")?k("Y\xEAu c\u1EA7u m\u1EA5t qu\xE1 nhi\u1EC1u th\u1EDDi gian. Vui l\xF2ng th\u1EED l\u1EA1i."):k("L\u1ED7i: "+u)}finally{i.disabled=!1,i.textContent="T\u1EA1o link"}}function k(e){let t=document.getElementById("affiliate-link-error");t&&(t.textContent=e,t.style.display="block")}function K(e){var t;e.select(),e.setSelectionRange(0,99999);try{document.execCommand("copy");let o=((t=e.nextElementSibling)==null?void 0:t.textContent)||"";e.nextElementSibling&&(e.nextElementSibling.textContent="\u0110\xE3 copy!",setTimeout(()=>{e.nextElementSibling&&(e.nextElementSibling.textContent=o)},2e3))}catch(o){console.error("Copy failed:",o)}}async function we(e){try{let t={...e,createdAt:new Date().toLocaleString("vi-VN"),timestamp:Date.now()};await idb.saveAffiliateLink(t),(await idb.getAllAffiliateLinks()).length>100}catch(t){console.error("Error saving affiliate link:",t)}}async function Ce(){try{return await idb.getAllAffiliateLinks()||[]}catch(e){return console.error("Error loading affiliate link history:",e),[]}}async function Ie(){let e=document.getElementById("affiliate-link-history-list"),t=document.getElementById("affiliate-link-history-btn");if(!(!e||!t))if(e.style.display==="none"||!e.style.display){let o=await Ce();if(o.length===0)e.innerHTML='<div style="padding: 10px; text-align: center; color: #999; font-size: 13px;">Ch\u01B0a c\xF3 l\u1ECBch s\u1EED</div>';else{let i='<div style="max-height: 300px; overflow-y: auto;">';o.forEach((l,n)=>{i+=`
                    <div style="padding: 10px; border-bottom: 1px solid #eee; ${n===o.length-1?"border-bottom: none;":""}">
                        <div style="font-size: 12px; color: #999; margin-bottom: 5px;">${l.createdAt}</div>
                        <div style="font-size: 12px; color: #555; margin-bottom: 5px; word-break: break-all;">${l.originalLink}</div>
                        <div style="display: flex; gap: 5px; margin-top: 5px;">
                            <input type="text" value="${l.shortLink||""}" readonly style="flex: 1; padding: 4px; border: 1px solid #ddd; border-radius: 3px; font-size: 11px; background: #f5f5f5;" />
                            <button class="history-copy-btn" data-link="${l.shortLink||""}" style="padding: 4px 8px; background: #4CAF50; color: white; border: none; border-radius: 3px; font-size: 11px; cursor: pointer;">Copy</button>
                        </div>
                    </div>
                `}),i+="</div>",e.innerHTML=i,e.querySelectorAll(".history-copy-btn").forEach(l=>{l.addEventListener("click",n=>{let s=n.target.getAttribute("data-link");if(s){let r=document.createElement("input");r.value=s,document.body.appendChild(r),r.select(),document.execCommand("copy"),document.body.removeChild(r),n.target.textContent="\u0110\xE3 copy!",setTimeout(()=>{n.target.textContent="Copy"},2e3)}})})}e.style.display="block",t.textContent="\u1EA8n l\u1ECBch s\u1EED"}else e.style.display="none",t.textContent="L\u1ECBch s\u1EED"}function te(){let e=document.getElementById("shopee-link-widget-panel");if(e&&(E=!E,e.style.display=E?"block":"none",E)){let t=document.getElementById("affiliate-link-url-input");t&&(t.value=window.location.href);let o=document.getElementById("affiliate-link-result"),i=document.getElementById("affiliate-link-history-list"),l=document.getElementById("affiliate-link-error");o&&(o.style.display="none"),i&&(i.style.display="none"),l&&(l.style.display="none")}}function ie(){let e=y();if(!e)return null;let t={item_id:e,item_name:null,category:null,brand:null,image:null,description:null,is_mall:!1,rating:null,rating_count:null,sold:null,price:null,original_price:null,discount:null,liked_count:null,shop_id:null,shop_name:null,shop_avatar:null,shop_rating:null,shop_rating_count:null,shop_joined_date:null,shop_followers:null,shop_products_count:null,extracted_at:new Date().toISOString(),url:window.location.href};try{let o=document.querySelectorAll('script[type="application/ld+json"]'),i=null,l=null;for(let r of o)try{let c=JSON.parse(r.textContent);if(c&&typeof c=="object"&&c["@type"]==="Product"&&(v("Found Product JSON-LD:",c),l=c,c.productID&&String(c.productID)===String(e))){i=c,v("Found matching Product JSON-LD with productID:",c.productID);break}}catch(c){v("Error parsing JSON-LD script:",c)}let n=i||l;if(n){if(v("Using Product JSON-LD:",n.productID||"no productID"),n.name&&(t.item_name=n.name),n.productID&&(t.item_id=String(n.productID)),n.brand&&(t.brand=n.brand),n.image&&(t.image=typeof n.image=="string"?n.image:n.image[0]),n.aggregateRating&&(n.aggregateRating.ratingValue&&(t.rating=parseFloat(n.aggregateRating.ratingValue)),n.aggregateRating.ratingCount)){let r=n.aggregateRating.ratingCount;t.rating_count=parseInt(typeof r=="string"?r.replace(/[.,]/g,""):r)}if(n.offers){let r=n.offers,c=r["@type"];if(c==="AggregateOffer"){if(r.lowPrice){let a=null;if(typeof r.lowPrice=="string"){let d=r.lowPrice.indexOf("."),p=d!==-1?r.lowPrice.slice(0,d):r.lowPrice;p=p.replace(/,/g,""),a=parseInt(p,10)}else a=Math.round(r.lowPrice);!isNaN(a)&&a>0&&(t.price=a)}if(r.highPrice&&!t.original_price){let a=null;if(typeof r.highPrice=="string"){let d=r.highPrice.indexOf("."),p=d!==-1?r.highPrice.slice(0,d):r.highPrice;p=p.replace(/,/g,""),a=parseInt(p,10)}else a=Math.round(r.highPrice)}}else if(c==="Offer"&&r.price){if(typeof r.price=="string"){let a=r.price.indexOf("."),d=a!==-1?r.price.slice(0,a):r.price;d=d.replace(/,/g,""),t.price=parseInt(d,10)}else t.price=Math.round(r.price);(isNaN(t.price)||t.price<=0)&&(t.price=null)}if(r.seller&&r.seller["@type"]==="Organization"){let a=r.seller;if(a.name&&(t.shop_name=a.name),a.image&&(t.shop_avatar=typeof a.image=="string"?a.image:a.image[0]),a.url){let d=a.url.match(/\/shop\/(\d+)/);d&&(t.shop_id=d[1])}if(a.aggregateRating&&a.aggregateRating["@type"]==="AggregateRating"&&(a.aggregateRating.ratingValue&&(t.shop_rating=parseFloat(a.aggregateRating.ratingValue)),a.aggregateRating.ratingCount)){let d=a.aggregateRating.ratingCount;t.shop_rating_count=parseInt(typeof d=="string"?d.replace(/[.,]/g,""):d)}a.name&&(a.name.includes("Official")||a.name.includes("Mall"))&&(t.is_mall=!0)}r.availability&&r.availability.includes("InStock")}n.description&&(t.description=n.description),n.url&&(t.url=n.url)}let s=document.querySelectorAll('script:not([src]):not([type="application/ld+json"])');for(let r of s){let c=r.textContent||"";if(c.includes('"@type":"Product"')||c.includes("productID")||c.includes("item_id"))try{let a=JSON.parse(c);a&&typeof a=="object"&&V(a,t)}catch{let d=c.match(/\{[\s\S]*"@type"\s*:\s*"Product"[\s\S]*\}/);if(d)try{let p=JSON.parse(d[0]);p&&p["@type"]==="Product"&&V(p,t)}catch{}}}if(typeof window<"u"){let r=window.__INITIAL_STATE__||window.__NEXT_DATA__||window.__PRELOADED_STATE__;if(r)try{let c=typeof r=="string"?JSON.parse(r):r;Ee(c,t)}catch{}}}catch(o){v("Error extracting from JSON:",o)}return Se(t),Le(t),t.item_id&&String(t.item_id)!==String(e)&&(v(`Warning: item_id (${t.item_id}) kh\xF4ng kh\u1EDBp v\u1EDBi productId t\u1EEB URL (${e}), reset v\u1EC1 productId t\u1EEB URL`),t.item_id=e),Te(t),t.item_id&&v(`Final extracted data - item_id: ${t.item_id}, name: ${t.item_name||"N/A"}, price: ${t.price||"N/A"}`),t}function V(e,t){if(!(!e||typeof e!="object")){if(e.name&&!t.item_name&&(t.item_name=e.name),e.productID&&!t.item_id&&(t.item_id=String(e.productID)),e.item_id&&!t.item_id&&(t.item_id=String(e.item_id)),e.price&&!t.price&&(t.price=b(e.price)),e.current_price&&!t.price&&(t.price=b(e.current_price)),e.original_price&&!t.original_price&&(t.original_price=b(e.original_price)),e.price_before_discount&&!t.original_price&&(t.original_price=b(e.price_before_discount)),e.rating&&!t.rating&&(t.rating=parseFloat(e.rating)),e.rating_star&&!t.rating&&(t.rating=parseFloat(e.rating_star)),e.rating_count&&!t.rating_count){let o=e.rating_count;t.rating_count=parseInt(typeof o=="string"?o.replace(/[.,]/g,""):o)}e.sold&&!t.sold&&(t.sold=parseInt(e.sold)),e.historical_sold&&!t.sold&&(t.sold=parseInt(e.historical_sold)),e.liked_count&&!t.liked_count&&(t.liked_count=parseInt(e.liked_count)),e.shopid&&!t.shop_id&&(t.shop_id=String(e.shopid)),e.shop_id&&!t.shop_id&&(t.shop_id=String(e.shop_id)),e.shop_name&&!t.shop_name&&(t.shop_name=e.shop_name),e.is_mall!==void 0&&(t.is_mall=!!e.is_mall)}}function Ee(e,t){if(!e||typeof e!="object")return;let o=(s,r="")=>{if(!s||typeof s!="object")return null;if(s.item_id||s.itemid||s.product_id||s.productId)return s;for(let c in s)if(c.includes("item")||c.includes("product")||c.includes("detail")){let a=o(s[c],`${r}.${c}`);if(a)return a}return null},i=o(e);i&&((i.name||i.item_name||i.title)&&(t.item_name=i.name||i.item_name||i.title),(i.price||i.current_price)&&(t.price=b(i.price||i.current_price)),(i.price_before_discount||i.original_price)&&(t.original_price=b(i.price_before_discount||i.original_price)),(i.rating||i.rating_star)&&(t.rating=parseFloat(i.rating||i.rating_star)),(i.rating_count||i.rating_count_total)&&(t.rating_count=parseInt(i.rating_count||i.rating_count_total)),(i.sold||i.historical_sold)&&(t.sold=parseInt(i.sold||i.historical_sold)),(i.liked_count||i.like_count)&&(t.liked_count=parseInt(i.liked_count||i.like_count)),(i.shopid||i.shop_id)&&(t.shop_id=String(i.shopid||i.shop_id)),i.is_mall!==void 0&&(t.is_mall=!!i.is_mall),i.catid||i.category_id);let l=s=>{if(!s||typeof s!="object")return null;if(s.shopid||s.shop_id||s.shop_name)return s;for(let r in s)if(r.includes("shop")){let c=l(s[r]);if(c)return c}return null},n=l(e);n&&((n.username||n.shop_name||n.name)&&(t.shop_name=n.username||n.shop_name||n.name),(n.portrait||n.avatar||n.shop_avatar)&&(t.shop_avatar=n.portrait||n.avatar||n.shop_avatar),(n.rating_star||n.rating)&&(t.shop_rating=parseFloat(n.rating_star||n.rating)),(n.rating_count||n.rating_count_total)&&(t.shop_rating_count=parseInt(n.rating_count||n.rating_count_total)),(n.ctime||n.created_time||n.joined_date)&&(t.shop_joined_date=n.ctime||n.created_time||n.joined_date),(n.follower_count||n.followers)&&(t.shop_followers=parseInt(n.follower_count||n.followers)),(n.item_count||n.products_count)&&(t.shop_products_count=parseInt(n.item_count||n.products_count)),n.is_official_shop!==void 0&&(t.is_mall=!!n.is_official_shop))}function Se(e){if(!e.item_name){let t=['h1[class*="product"]','h1[class*="name"]','[class*="product-name"]','[class*="product_title"]','[data-testid*="product-name"]',"h1",".product-name",".product-title"];for(let o of t){let i=document.querySelector(o);if(i&&i.textContent&&i.textContent.trim().length>0){e.item_name=i.textContent.trim();break}}}if(!e.price){let t=['[class*="price"]','[class*="Price"]','[data-testid*="price"]'];for(let o of t){let i=document.querySelectorAll(o);for(let l of i){let n=l.textContent||"";if(n.includes("\u20AB")||n.includes("\u0111")){let s=n.match(/(\d{1,3}(?:[.,]\d{3})*)\s*[₫đ]?\s*[-–—]\s*(\d{1,3}(?:[.,]\d{3})*)\s*[₫đ]/),r=null;if(s){let c=s[1].replace(/[.,]/g,"");r=parseInt(c,10)}else r=b(n);if(r>0){e.price=r;break}}}if(e.price)break}}if(!e.original_price){let t=!1,o=document.querySelectorAll(".jRlVo0");for(let i of o){let n=function(s){if(!s||typeof s!="string")return null;let r=s.match(/(\d{1,3}(?:[.,]\d{3})*)\s*[₫đ]?\s*[-–—]\s*(\d{1,3}(?:[.,]\d{3})*)\s*[₫đ]/);if(r){let a=r[1].replace(/[.,]/g,""),d=parseInt(a,10);if(!isNaN(d)&&d>0)return d}let c=b(s);if(c>0&&c<1e4&&/\d+\.\d{3}[^\d]/.test(s)){let a=s.match(/(\d{1,3}(?:\.\d{3})+)[^\d]/);if(a&&a[1])return parseInt(a[1].replace(/\./g,""),10)}if(c>0&&c<1e4&&/\d+\,\d{3}[^\d]/.test(s)){let a=s.match(/(\d{1,3}(?:\,\d{3})+)[^\d]/);if(a&&a[1])return parseInt(a[1].replace(/\,/g,""),10)}return c},l=Array.from(i.children).filter(s=>s.tagName==="DIV"&&!s.className.includes("shopee-drawer"));if(l.length===2){let s=l[0].textContent||"",r=l[1].textContent||"",c=n(s),a=n(r);if(c>0&&a>0&&a>c){(!e.price||e.price===c)&&(e.price=c),e.original_price=a,t=!0;break}}if(!t&&l.length>1){let s=l.map(r=>({price:n(r.textContent||""),div:r})).filter(({price:r})=>r>0);if(s.length>=2){s.sort((a,d)=>a.price-d.price);let r=s[0].price,c=s[s.length-1].price;if(c>r){(!e.price||e.price===r)&&(e.price=r),e.original_price=c,t=!0;break}}}if(!t&&l.length===1){let r=l[0].textContent||"",c=n(r);if(c>0&&c>(e.price||0)){e.original_price=c,t=!0;break}}}if(!t){let i=document.querySelector(".jRlVo0");if(i){let l=i.querySelector(".IZPeQz.B67UQ0"),n=i.querySelector(".ZA5sW5");if(l&&n){let c=function(p){let u=p.match(/(\d{1,3}(?:[.,]\d{3})*)\s*[₫đ]?\s*[-–—]\s*(\d{1,3}(?:[.,]\d{3})*)\s*[₫đ]/);if(u){let ne=u[1].replace(/[.,]/g,""),oe=u[2].replace(/[.,]/g,"");return{min:parseInt(ne,10),max:parseInt(oe,10),isRange:!0}}let h=parseFullPrice(p);return{min:h,max:h,isRange:!1}},s=l.textContent||"",r=n.textContent||"",a=c(s),d=c(r);if(a.min>0&&d.min>0){let p=a.min,u=d.min;u>p?((!e.price||e.price===p)&&(e.price=p),e.original_price=u,t=!0):p>0&&((!e.price||e.price===p)&&(e.price=p),u>p&&(e.original_price=u),t=!0)}}}}if(!t){let l=function(n){let s=b(n);if(s>0&&s<1e4&&/\d+\.\d{3}[^\d]/.test(n)){let r=n.match(/(\d{1,3}(?:\.\d{3})+)[^\d]/);if(r&&r[1])return parseInt(r[1].replace(/\./g,""),10)}if(s>0&&s<1e4&&/\d+\,\d{3}[^\d]/.test(n)){let r=n.match(/(\d{1,3}(?:\,\d{3})+)[^\d]/);if(r&&r[1])return parseInt(r[1].replace(/\,/g,""),10)}return s},i=['[class*="original-price"]','[class*="old-price"]','[class*="before-discount"]','[class*="strike"]'];for(let n of i){let s=document.querySelector(n);if(s){let r=s.textContent||"";if(r.includes("\u20AB")||r.includes("\u0111")){let c=l(r);if(c>0&&c>(e.price||0)){e.original_price=c,t=!0;break}}}}}}if(!e.rating){let t=['[class*="rating"]','[class*="Rating"]','[data-testid*="rating"]','[aria-label*="rating"]'];for(let o of t){let i=document.querySelector(o);if(i){let n=(i.textContent||"").match(/(\d+[.,]?\d*)/);if(n){let s=parseFloat(n[1].replace(",","."));if(s>=0&&s<=5){e.rating=s;break}}}}}if(!e.rating_count){let t=['[class*="rating-count"]','[class*="review-count"]'];for(let o of t){let i=document.querySelector(o);if(i){let n=(i.textContent||"").match(/(\d+[.,]?\d*)/);if(n){e.rating_count=parseInt(n[1].replace(/[.,]/g,""));break}}}}if(!e.sold){let t=document.querySelectorAll("div.aleSBU");for(let o of t){let i=o.textContent||"";if(/đã bán/i.test(i)){let l=null,n=o.querySelector("span");if(n&&n.textContent){let s=n.textContent.trim(),r=s.match(/^([\d.,]+)\s*(k|K|m|M|tr|TR)?\+?$/);if(r){let c=r[1].replace(",","."),a=1,d=r[2]?r[2].toLowerCase():"";if(d==="k"?a=1e3:(d==="m"||d==="tr")&&(a=1e6),l=parseFloat(c)*a,!isNaN(l)&&l>0){e.sold=Math.round(l);break}}else{let c=parseInt(s.replace(/[^\d]/g,""));if(!isNaN(c)&&c>0){e.sold=c;break}}}if(!e.sold){let s=i.match(/đã bán\s*(\d+[.,]?\d*)/i);if(s){e.sold=parseInt(s[1].replace(/[.,]/g,""));break}}}}}if(!e.sold){let t=['[class*="sold"]','[class*="Sold"]','[class*="historical-sold"]'];for(let o of t){let i=document.querySelectorAll(o);for(let l of i){let n=l.textContent||"";if(n.includes("\u0111\xE3 b\xE1n")||n.includes("sold")||n.includes("\u0110\xE3 b\xE1n")){let s=n.match(/(\d+[.,]?\d*)\s*(k|K|m|M|tr|TR)?\+?/);if(s){let r=s[1].replace(",","."),c=1,a=s[2]?s[2].toLowerCase():"";a==="k"?c=1e3:(a==="m"||a==="tr")&&(c=1e6);let d=parseFloat(r)*c;if(!isNaN(d)&&d>0){e.sold=Math.round(d);break}}}}if(e.sold)break}}if(!e.liked_count){let t=document.querySelectorAll("div.rhG6k7");for(let o of t){let i=o.textContent||"";if(/đã thích\s*\(\d+[.,]?\d*\)/i.test(i)){let l=i.match(/đã thích\s*\((\d+[.,]?\d*)\)/i);if(l){e.liked_count=parseInt(l[1].replace(/[.,]/g,""));break}}}if(!e.liked_count){let o=['[class*="like"]','[class*="favorite"]','[class*="wishlist"]'];for(let i of o){let l=document.querySelectorAll(i);for(let n of l){let s=n.textContent||"";if(s.match(/\d+/)){let r=s.match(/(\d+[.,]?\d*)/);if(r){e.liked_count=parseInt(r[1].replace(/[.,]/g,""));break}}}if(e.liked_count)break}}}if(!e.category){let t=['[class*="breadcrumb"]','[class*="category"]','[class*="Category"]','nav[aria-label*="breadcrumb"]'];for(let o of t){let i=document.querySelector(o);if(i){let l=i.querySelectorAll("a");if(l.length>0){let n=Array.from(l).map(s=>{var r;return(r=s.textContent)==null?void 0:r.trim()}).filter(Boolean);if(n.length>0){e.category=n.join(" > ");break}}}}}if(e.is_mall===!1){let t=['[class*="mall"]','[class*="official"]','[class*="verified"]','[title*="Mall"]','[title*="Official"]'];for(let o of t)if(document.querySelector(o)){e.is_mall=!0;break}}}function Le(e){var t;if(!e.shop_name){let o=['[class*="shop-name"]','[class*="shopName"]','[class*="seller-name"]','a[href*="/shop/"]'];for(let i of o){let l=document.querySelector(i);if(l){let n=((t=l.textContent)==null?void 0:t.trim())||l.getAttribute("title")||l.getAttribute("aria-label");if(n&&n.length>0&&!n.includes("http")){e.shop_name=n;break}}}}if(!e.shop_avatar){let o=['[class*="shop-avatar"]','[class*="shopAvatar"]','[class*="seller-avatar"]','img[src*="shopee"]'];for(let i of o){let l=document.querySelector(i);if(l&&l.src){e.shop_avatar=l.src;break}}}if(!e.shop_rating){let o=['[class*="shop-rating"]','[class*="seller-rating"]'];for(let i of o){let l=document.querySelector(i);if(l){let s=(l.textContent||"").match(/(\d+[.,]?\d*)/);if(s){let r=parseFloat(s[1].replace(",","."));if(r>=0&&r<=5){e.shop_rating=r;break}}}}}if(!e.shop_followers){let o=document.querySelector(".page-product__shop, section.page-product__shop"),i=!1;if(o){let l=o.querySelectorAll(".YnZi6x");for(let n of l){let s=n.querySelector(".ffHYws"),r=n.querySelector(".Cs6w3G");if(s&&r&&s.textContent&&r.textContent&&/người theo dõi|theo dõi|followers/i.test(s.textContent)){let c=r.textContent.trim(),a=0;if(c.match(/k|K/)?a=parseFloat(c.replace(/[^\d.,]/g,"").replace(",","."))*1e3:c.match(/m|M/)?a=parseFloat(c.replace(/[^\d.,]/g,"").replace(",","."))*1e6:c.match(/tr|TR|Tr/)?a=parseFloat(c.replace(/[^\d.,]/g,"").replace(",","."))*1e6:a=parseInt(c.replace(/[^\d]/g,"")),a>0){e.shop_followers=Math.round(a),i=!0;break}}}}if(!i){let l=['[class*="followers"]','[class*="follower"]'];for(let n of l){let s=document.querySelectorAll(n);for(let r of s){let c=r.textContent||"";if(c.includes("theo d\xF5i")||c.includes("followers")||c.includes("ng\u01B0\u1EDDi theo d\xF5i")){let a=c.match(/([\d.,]+)\s*(k|K|m|M|tr|TR)?/);if(a){let d=a[1].replace(",","."),p=1,u=a[2]?a[2].toLowerCase():"";u==="k"?p=1e3:(u==="m"||u==="tr")&&(p=1e6);let h=parseFloat(d)*p;if(!isNaN(h)&&h>0){e.shop_followers=Math.round(h),i=!0;break}}}}if(e.shop_followers)break}}}if(!e.shop_products_count){let o=!1,i=document.querySelectorAll(".NGzCXN .YnZi6x");for(let l of i){let n=l.querySelector("label");if(n&&n.textContent&&n.textContent.trim().toLowerCase().includes("s\u1EA3n ph\u1EA9m")){let s=l.querySelector("span.Cs6w3G"),r=s?s.textContent.trim():null;if(r){let c=r.match(/^([\d.,]+)\s*(k|K|m|M|tr|TR)?/);if(c){let a=c[1].replace(",","."),d=1,p=c[2]?c[2].toLowerCase():"";p==="k"?d=1e3:(p==="m"||p==="tr")&&(d=1e6);let u=parseFloat(a)*d;if(!isNaN(u)&&u>0){e.shop_products_count=Math.round(u),o=!0;break}}else{let a=parseInt(r.replace(/[^\d]/g,""));if(!isNaN(a)&&a>0){e.shop_products_count=a,o=!0;break}}}}}if(!o){let l=['[class*="products-count"]','[class*="item-count"]'];for(let n of l){let s=document.querySelectorAll(n);for(let r of s){let c=r.textContent||"";if(c.includes("s\u1EA3n ph\u1EA9m")||c.includes("products")){let a=c.match(/(\d+[.,]?\d*)/);if(a){e.shop_products_count=parseInt(a[1].replace(/[.,]/g,"")),o=!0;break}}}if(e.shop_products_count)break}}}if(!e.shop_id){let o=document.querySelector('link[rel="canonical"][href*="-i."]');if(o&&o.href){let i=o.href.match(/-i\.(\d+)\.(\d+)/);i&&(e.shop_id=i[1])}}}function b(e){if(e==null)return null;if(typeof e=="number")return isNaN(e)?null:Math.round(e);let o=e.toString().replace(/[₫đ,]/g,"").replace(/\s/g,"").trim().match(/(\d+(?:\.\d+)?)/);if(o){let i=parseFloat(o[1]);return isNaN(i)?null:Math.round(i)}return null}function Te(e){if(e.original_price&&e.price&&e.original_price>e.price){let t=e.original_price-e.price;e.discount=Math.round(t/e.original_price*100)}e.price&&isNaN(e.price)&&(e.price=null),e.original_price&&isNaN(e.original_price)&&(e.original_price=null),e.rating&&(isNaN(e.rating)||e.rating<0||e.rating>5)&&(e.rating=null),e.sold&&isNaN(e.sold)&&(e.sold=null),e.liked_count&&isNaN(e.liked_count)&&(e.liked_count=null),e.shop_rating&&(isNaN(e.shop_rating)||e.shop_rating<0||e.shop_rating>5)&&(e.shop_rating=null),e.shop_followers&&isNaN(e.shop_followers)&&(e.shop_followers=null),e.shop_products_count&&isNaN(e.shop_products_count)&&(e.shop_products_count=null),e.item_name&&typeof e.item_name=="string"&&(e.item_name=e.item_name.trim()),e.shop_name&&typeof e.shop_name=="string"&&(e.shop_name=e.shop_name.trim()),e.category&&typeof e.category=="string"&&(e.category=e.category.trim())}function w(e=0){let t=y();if(!t)return;let o=5,i=2e3;if(e>=o){console.warn("[Shopee Product] Kh\xF4ng th\u1EC3 extract product data sau "+o+" l\u1EA7n th\u1EED");return}if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",()=>{setTimeout(()=>{w(e)},1e3)});return}if(document.readyState!=="complete"){window.addEventListener("load",()=>{setTimeout(()=>{w(e)},1e3)});return}let l=ie();l?(!l.item_id&&t&&(l.item_id=t),console.log("[Shopee Product] Extracted product data:",l)):e<o&&setTimeout(()=>{w(e+1)},i)}chrome.runtime.onMessage.addListener((e,t,o)=>{if(e.type==="SHOW_PRODUCT_STATS"){let i=y();i&&(L=i,_?U():H()),o({success:!0})}else if(e.type==="GET_COOKIES"){let i=document.cookie;return o({cookies:i||""}),!0}return!0});document.readyState==="loading"?document.addEventListener("DOMContentLoaded",G):G();function G(){let e=y();e&&(W(),X(),j(e));let t=new URL(window.location.href);t.hostname==="shopee.vn"&&t.pathname!=="/"&&t.pathname.length>1&&(Y(),Z()),Pe(),e&&(document.readyState==="complete"?setTimeout(async()=>{w(0),(await chrome.storage.local.get("priceHistoryEnabled")).priceHistoryEnabled!==!1&&C(e,0);let i=await P();await z(i)},2e3):window.addEventListener("load",()=>{setTimeout(async()=>{w(0),(await chrome.storage.local.get("priceHistoryEnabled")).priceHistoryEnabled!==!1&&C(e,0);let i=await P();await z(i)},2e3)}))}var I=(()=>{let e=null;return()=>{e&&clearTimeout(e),e=setTimeout(()=>{Re()},300)}})();function Pe(){let e=window.location.href,t=()=>{e=window.location.href,I()};window.addEventListener("popstate",t),R.push({element:window,event:"popstate",handler:t});let o=history.pushState,i=history.replaceState;history.pushState=function(...s){o.apply(history,s),e=window.location.href,I()},history.replaceState=function(...s){i.apply(history,s),e=window.location.href,I()};let l=null;T=new MutationObserver(()=>{window.location.href!==e&&(e=window.location.href,l&&clearTimeout(l),l=setTimeout(()=>{I()},500))});let n=document.body||document.documentElement;n&&T.observe(n,{childList:!0,subtree:!0}),A=setInterval(()=>{window.location.href!==e&&(e=window.location.href,I())},2e3)}function Ae(){T&&(T.disconnect(),T=null),A&&(clearInterval(A),A=null),R.forEach(({element:e,event:t,handler:o})=>{e.removeEventListener(t,o)}),R=[],f.clear()}function Re(){let e=new URL(window.location.href);if(e.hostname==="shopee.vn"&&e.pathname!=="/"&&e.pathname.length>1)if(f.getAffiliateLinkIcon()||Y(),!f.getAffiliateLinkPanel())Z();else{if(E){let o=f.getAffiliateLinkPanel(),i=o==null?void 0:o.querySelector("#affiliate-link-url-input");i&&(i.value=window.location.href)}Q()}else{let o=f.getAffiliateLinkIcon(),i=f.getAffiliateLinkPanel();o&&(o.remove(),f.affiliateLinkIcon=null),i&&(i.remove(),f.affiliateLinkPanel=null)}let t=y();if(t)if(f.getWidgetIcon()||W(),f.getWidgetPanel()||X(),L!==t){if(m&&(m.remove(),m=null),B){try{B.destroy()}catch{}B=null}re=null,D=null,M(),L=t,v(`Product ID changed to: ${t}`),j(t),_&&U(),setTimeout(async()=>{w(0),(await chrome.storage.local.get("priceHistoryEnabled")).priceHistoryEnabled!==!1&&C(t,0);let i=await P();await z(i)},2e3)}else setTimeout(async()=>{let o=await P();o&&!document.getElementById("shopee-commission-info-display")&&await z(o)},2e3);else{let o=f.getWidgetIcon(),i=f.getWidgetPanel();o&&(o.remove(),f.widgetIcon=null),i&&(i.remove(),f.widgetPanel=null),M(),D=null,L=null}}window.addEventListener("beforeunload",Ae);})();

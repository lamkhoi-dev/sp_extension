(()=>{(function(){"use strict";let K="/api/v3/offer/product",C=null,m=null,g=!1,q=!1;function o(e,...t){q&&console.log(`[Affiliate Product Offer Debug] ${e}`,...t)}function w(){let t=new URL(window.location.href).pathname.split("/"),i=t.indexOf("product_offer");return i!==-1&&t[i+1]?t[i+1]:null}function b(e){if(!e)return"0 \u20AB";if(typeof e=="string"&&e.includes("\u20AB"))return e;let t=typeof e=="string"?parseInt(e):e;return isNaN(t)?"0 \u20AB":(t>1e6&&(t=t/1e5),new Intl.NumberFormat("vi-VN",{style:"currency",currency:"VND",minimumFractionDigits:0}).format(t))}function E(e){return e?new Date(parseInt(e)*1e3).toLocaleString("vi-VN",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}):"N/A"}function D(e){let t=document.createElement("textarea");t.value=e,t.style.position="fixed",t.style.opacity="0",document.body.appendChild(t),t.select();try{return document.execCommand("copy"),!0}catch(i){return console.error("Failed to copy:",i),!1}finally{document.body.removeChild(t)}}function p(e){let t=typeof e=="string"?parseFloat(e.replace("%","")):e;return t>=7?"primary":t>=5?"success":"warning"}function N(e){return e?`https://cf.shopee.vn/file/${e}`:""}function j(e){return{1:"Social Media",2:"Shopee Video",3:"Live Streaming"}[e]||`K\xEAnh ${e}`}function G(e){if(!e)return"N/A";let t=Math.floor(e/60),i=e%60;return`${t.toString().padStart(2,"0")}:${i.toString().padStart(2,"0")}`}function z(e){return e?`https://cf.shopee.vn/file/${e}`:""}function Q(e){if(!e||!Array.isArray(e)||e.length===0)return'<div style="color: #999; font-size: 13px;">Kh\xF4ng c\xF3 video</div>';let t='<div class="affiliate-video-list">';return e.forEach((i,a)=>{var _,f,l,c;let n=i.thumb_url?z(i.thumb_url):"",s=i.duration?G(i.duration):"N/A",d=((_=i.default_format)==null?void 0:_.defn)||"N/A",r=((f=i.default_format)==null?void 0:f.url)||((c=(l=i.formats)==null?void 0:l[0])==null?void 0:c.url)||"";t+=`
                <div class="affiliate-video-item">
                    ${n?`
                    <div class="affiliate-video-thumbnail-wrapper">
                        <img src="${n}" alt="Video ${a+1}" class="affiliate-video-thumbnail" />
                        <div class="affiliate-video-duration">${s}</div>
                    </div>
                    `:""}
                    <div class="affiliate-video-info">
                        <div class="affiliate-video-title">Video ${a+1}</div>
                        <div class="affiliate-video-meta">
                            <span>\u23F1\uFE0F ${s}</span>
                            <span>\u{1F4F9} ${d}</span>
                        </div>
                        ${r?`
                        <a href="${r}" target="_blank" class="affiliate-video-link">Xem video</a>
                        `:""}
                    </div>
                </div>
            `}),t+="</div>",t}function W(e,t){if(!e||!t)return null;let i=typeof e=="string"?parseInt(e):e;if(isNaN(i))return null;i>1e6&&(i=i/1e5);let a=0;if(typeof t=="string"?a=parseFloat(t.replace("%",""))||0:a=t>100?t/100:t,a===0)return null;let n=i*a/100;return b(n)}function X(e,t){var f;let i=0,a=e.batch_item_for_item_card_full||{},n=e.default_commission_rate||e.seller_commission_rate||"0%",s=typeof n=="string"?parseFloat(n.replace("%","")):n>100?n/100:n;if(s>=7?i+=3:s>=5?i+=2:s>=3&&(i+=1),t&&a.price){let l=typeof a.price=="string"?parseInt(a.price):a.price,c=typeof t=="string"?parseInt(t):t;l>1e6&&(l=l/1e5),c>1e6&&(c=c/1e5),l<c*.9?i+=2:l<c&&(i+=1)}let d=((f=a.item_rating)==null?void 0:f.rating_star)||0;return d>=4.8?i+=2:d>=4.5&&(i+=1),(a.cmt_count||0)>=500&&(i+=1),(a.liked_count||0)>=1e3&&(i+=1),i}function Y(e,t){if(!e||!e.list||!Array.isArray(e.list)||e.list.length===0)return'<div style="color: #999; font-size: 13px;">Kh\xF4ng c\xF3 s\u1EA3n ph\u1EA9m t\u01B0\u01A1ng t\u1EF1</div>';let a=((t==null?void 0:t.batch_item_for_item_card_full)||{}).price,n='<div class="affiliate-similar-products-grid">';return e.list.forEach((s,d)=>{var H;let r=s.batch_item_for_item_card_full||{},_=r.image?N(r.image):"",f=r.name||"N/A",l=r.price,c=typeof l=="string"?parseInt(l):l;c>1e6&&(c=c/1e5);let ce=b(r.price),h=s.commission;if(!h||h==="N/A"){let u=s.seller_commission_rate||s.default_commission_rate;h=W(r.price,u)}h||(h="N/A");let U=s.default_commission_rate||s.seller_commission_rate||"N/A",S="";if(a&&r.price){let u=typeof a=="string"?parseInt(a):a;u>1e6&&(u=u/1e5);let k=(c-u)/u*100;k<-5?S=`<span class="affiliate-price-comparison lower">\u2193 R\u1EBB h\u01A1n ${Math.abs(k).toFixed(0)}%</span>`:k>5?S=`<span class="affiliate-price-comparison higher">\u2191 \u0110\u1EAFt h\u01A1n ${k.toFixed(0)}%</span>`:S='<span class="affiliate-price-comparison same">\u2248 T\u01B0\u01A1ng \u0111\u01B0\u01A1ng</span>'}let A=X(s,a)>=6,O=s.long_link||"",pe=s.product_link||"",le=`https://affiliate.shopee.vn/offer/product_offer/${s.item_id}`,M=r.sold_text||"",R=r.historical_sold_text||"",B=r.liked_count||0,P=r.discount||"",V=((H=r.item_rating)==null?void 0:H.rating_star)||0,F=r.cmt_count||0;n+=`
                <div class="affiliate-similar-product-card ${A?"recommended":""}">
                    ${A?'<div class="affiliate-recommended-badge">\u2B50 \u0110\u1EC1 xu\u1EA5t</div>':""}
                    ${_?`
                    <div class="affiliate-similar-product-image-wrapper">
                        <img src="${_}" alt="${f}" class="affiliate-similar-product-image" />
                        ${P?`<div class="affiliate-similar-product-discount">-${P}</div>`:""}
                    </div>
                    `:""}
                    <div class="affiliate-similar-product-info">
                        <div class="affiliate-similar-product-name" title="${f}">${f}</div>
                        <div class="affiliate-similar-product-price-row">
                            <span class="affiliate-similar-product-price">${ce}</span>
                            ${S}
                        </div>
                        <div class="affiliate-similar-product-meta">
                            ${V>0?`
                            <div class="affiliate-similar-product-meta-item">
                                <span>\u2B50</span>
                                <span>${V.toFixed(1)}</span>
                                ${F>0?`<span>(${F})</span>`:""}
                            </div>
                            `:""}
                            ${B>0?`
                            <div class="affiliate-similar-product-meta-item">
                                <span>\u2764\uFE0F</span>
                                <span>${B.toLocaleString("vi-VN")}</span>
                            </div>
                            `:""}
                            ${M?`
                            <div class="affiliate-similar-product-meta-item">
                                <span>\u{1F6D2}</span>
                                <span>${M}</span>
                            </div>
                            `:""}
                            ${R?`
                            <div class="affiliate-similar-product-meta-item">
                                <span>\u{1F4C8}</span>
                                <span>${R}</span>
                            </div>
                            `:""}
                        </div>
                        <div class="affiliate-similar-product-commission">
                            <span class="affiliate-similar-product-commission-label">Hoa h\u1ED3ng:</span>
                            <span class="affiliate-similar-product-commission-value">${h}</span>
                            <span class="affiliate-similar-product-rate">
                                <span class="affiliate-rate-badge ${p(U)}">${U}</span>
                            </span>
                        </div>
                        ${O?`
                        <div class="affiliate-similar-product-actions">
                            <button class="affiliate-link-btn" data-copy="similar-long-link-${d}" style="font-size: 0.7rem; padding: 0.4rem 0.8rem;">Copy Link</button>
                            <input type="hidden" id="similar-long-link-${d}" value="${O}" />
                            <a href="${le}" target="_blank" rel="noopener noreferrer" class="affiliate-product-direct-link-btn" style="font-size: 0.75rem; margin-left: 8px; padding: 0.4rem 0.8rem; text-decoration: none; color: #fff; background: #007aff; border: none; border-radius: 4px; display: inline-block;">Xem</a>
                        </div>
                        `:""}
                    </div>
                </div>
            `}),n+="</div>",n}function x(e){if(g||!e)return;let t=document.querySelector(".product-offer-details");if(t||(t=document.querySelector('[class*="product-offer"]')||document.querySelector('[class*="offer"]')||document.querySelector("main")||document.querySelector(".container")||document.body,o("Kh\xF4ng t\xECm th\u1EA5y .product-offer-details, s\u1EED d\u1EE5ng element kh\xE1c:",t)),!t){o("Kh\xF4ng t\xECm th\u1EA5y element ph\xF9 h\u1EE3p, \u0111\u1EE3i...");let a=0,n=10,s=setInterval(()=>{a++;let d=document.querySelector(".product-offer-details")||document.querySelector("main")||document.querySelector(".container")||document.body;(d||a>=n)&&(clearInterval(s),d?x(e):o("Kh\xF4ng th\u1EC3 t\xECm th\u1EA5y element sau nhi\u1EC1u l\u1EA7n th\u1EED"))},500);return}g=!0,C=e;let i=document.createElement("div");i.className="affiliate-product-offer-wrapper",i.innerHTML=J(e),t.nextSibling?t.parentNode.insertBefore(i,t.nextSibling):t.parentNode.appendChild(i),te(i,e),o("\u0110\xE3 render UI th\xE0nh c\xF4ng")}function J(e){let t=e.batch_item_for_item_card_full||{},i=e.commission_rate||{},a=e.commission_rate_detail||{};return`
            <!-- Product Info Card -->
            <div class="affiliate-offer-card">
                <div class="affiliate-offer-card-header">
                    <span>\u{1F4E6}</span>
                    <span>Th\xF4ng tin S\u1EA3n ph\u1EA9m</span>
                </div>
                <div class="affiliate-offer-card-body">
                    <div class="affiliate-product-info">
                        ${t.image?`
                        <img src="${N(t.image)}" alt="${t.name||""}" class="affiliate-product-image" />
                        `:""}
                        <div class="affiliate-product-details">
                            <div class="affiliate-product-name">${t.name||"N/A"}</div>
                            <div class="affiliate-product-price-row">
                                <span class="affiliate-product-price">${b(t.price)}</span>
                                ${t.price_before_discount?`
                                <span class="affiliate-product-original-price">${b(t.price_before_discount)}</span>
                                `:""}
                                ${t.discount?`
                                <span class="affiliate-product-discount">-${t.discount}</span>
                                `:""}
                            </div>
                            <div class="affiliate-product-meta">
                                ${t.stock!==void 0?`
                                <div class="affiliate-product-meta-item">
                                    <span>\u{1F4E6}</span>
                                    <span>T\u1ED3n kho: <strong>${t.stock.toLocaleString("vi-VN")}</strong></span>
                                </div>
                                `:""}
                                ${t.sold!==void 0?`
                                <div class="affiliate-product-meta-item">
                                    <span>\u{1F6D2}</span>
                                    <span>\u0110\xE3 b\xE1n 30 ng\xE0y qua: <strong>${t.sold}</strong></span>
                                </div>
                                `:""}
                                ${t.historical_sold_text?`
                                <div class="affiliate-product-meta-item">
                                    <span>\u{1F4C8}</span>
                                    <span>L\u1ECBch s\u1EED: <strong>${t.historical_sold_text}</strong></span>
                                </div>
                                `:""}
                                ${t.cmt_count!==void 0?`
                                <div class="affiliate-product-meta-item">
                                    <span>\u{1F4AC}</span>
                                    <span>\u0110\xE1nh gi\xE1: <strong>${t.cmt_count}</strong></span>
                                </div>
                                `:""}
                                ${t.liked_count!==void 0?`
                                <div class="affiliate-product-meta-item">
                                    <span>\u2764\uFE0F</span>
                                    <span>Y\xEAu th\xEDch: <strong>${t.liked_count.toLocaleString("vi-VN")}</strong></span>
                                </div>
                                `:""}
                            </div>
                            ${e.affiliate_promoted_last_7days?`
                            <div class="affiliate-voucher-badge">
                                <span>\u{1F93C}</span>
                                <span><strong>${e.affiliate_promoted_last_7days||""}</strong> KOL Qu\u1EA3ng B\xE1</span>
                            </div>
                            `:""}
                            ${typeof t.sold=="number"&&t.sold>0?`
                            <div class="affiliate-voucher-badge">
                                <span>\u26A1</span>
                                <span><strong>${(Math.round(t.sold/30*10)/10).toLocaleString("vi-VN")}</strong> \u0111\u01A1n/ng\xE0y</span>
                            </div>
                            `:""}
                            ${t.voucher_info?`
                            <div class="affiliate-voucher-badge">
                                <span>\u{1F3AB}</span>
                                <span><strong>${t.voucher_info.voucher_code||""}</strong> - ${t.voucher_info.label||""}</span>
                            </div>
                            `:""}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Quick Overview Card -->
            <div class="affiliate-offer-card">
                <div class="affiliate-offer-card-header">
                    <span>\u{1F4B0}</span>
                    <span>Th\xF4ng tin Hoa h\u1ED3ng & S\u1EA3n ph\u1EA9m</span>
                </div>
                <div class="affiliate-offer-card-body">
                    <div class="affiliate-offer-grid">
                        ${e.most_used_channel!==void 0?`
                        <div class="affiliate-offer-stat-item">
                            <div class="affiliate-offer-stat-label">K\xEAnh ra \u0111\u01A1n nhi\u1EC1u nh\u1EA5t</div>
                            <div class="affiliate-offer-stat-value secondary">${j(e.most_used_channel)}</div>
                        </div>
                        `:""}
                        <div class="affiliate-offer-stat-item">
                            <div class="affiliate-offer-stat-label">Hoa h\u1ED3ng</div>
                            <div class="affiliate-offer-stat-value">${e.commission||"N/A"}</div>
                        </div>
                        <div class="affiliate-offer-stat-item">
                            <div class="affiliate-offer-stat-label">T\u1EF7 l\u1EC7 m\u1EB7c \u0111\u1ECBnh</div>
                            <div class="affiliate-offer-stat-value">${i.default_commission_rate||"N/A"}</div>
                        </div>
                        <div class="affiliate-offer-stat-item">
                            <div class="affiliate-offer-stat-label">Hoa h\u1ED3ng Shopee</div>
                            <div class="affiliate-offer-stat-value secondary">${i.shopee_commission||"N/A"}</div>
                        </div>
                        <div class="affiliate-offer-stat-item">
                            <div class="affiliate-offer-stat-label">Hoa h\u1ED3ng Seller</div>
                            <div class="affiliate-offer-stat-value secondary">${i.seller_commission||"N/A"}</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Similar Products -->
            ${e.similar_product_offers&&e.similar_product_offers.list&&e.similar_product_offers.list.length>0?`
            <div class="affiliate-offer-card">
                <div class="affiliate-offer-card-header">
                    <span>\u{1F6CD}\uFE0F</span>
                    <span>S\u1EA3n ph\u1EA9m T\u01B0\u01A1ng t\u1EF1</span>
                </div>
                <div class="affiliate-offer-card-body">
                    ${Y(e.similar_product_offers,e)}
                </div>
            </div>
            `:""}
            
            <!-- Video List -->
            ${t.video_info_list&&t.video_info_list.length>0?`
            <div class="affiliate-offer-card">
                <div class="affiliate-offer-card-header">
                    <span>\u{1F3A5}</span>
                    <span>Video S\u1EA3n ph\u1EA9m</span>
                </div>
                <div class="affiliate-offer-card-body">
                    ${Q(t.video_info_list)}
                </div>
            </div>
            `:""}

            <!-- Links Section -->
            <div class="affiliate-offer-card">
                <div class="affiliate-offer-card-header">
                    <span>\u{1F517}</span>
                    <span>Links Ti\u1EBFp th\u1ECB</span>
                </div>
                <div class="affiliate-offer-card-body">
                    <div class="affiliate-links-section">
                        ${e.long_link?`
                        <div class="affiliate-link-label">Long Link</div>
                        <div class="affiliate-link-item">
                            <input type="text" class="affiliate-link-input" value="${e.long_link}" readonly id="affiliate-long-link" />
                            <button class="affiliate-link-btn" data-copy="affiliate-long-link">Copy</button>
                        </div>
                        `:""}
                        ${e.productLink?`
                        <div class="affiliate-link-label">Product Link</div>
                        <div class="affiliate-link-item">
                            <input type="text" class="affiliate-link-input" value="${e.productLink}" readonly id="affiliate-product-link" />
                            <button class="affiliate-link-btn secondary" onclick="window.open('${e.productLink}', '_blank')">M\u1EDF</button>
                            <button class="affiliate-link-btn" data-copy="affiliate-product-link">Copy</button>
                        </div>
                        `:""}
                    </div>
                </div>
            </div>

            <!-- Commission Rates Table -->
            <div class="affiliate-offer-card">
                <div class="affiliate-offer-card-header">
                    <span>\u{1F4CA}</span>
                    <span>Chi ti\u1EBFt T\u1EF7 l\u1EC7 Hoa h\u1ED3ng</span>
                </div>
                <div class="affiliate-offer-card-body">
                    <table class="affiliate-commission-table">
                        <thead>
                            <tr>
                                <th>Lo\u1EA1i</th>
                                <th>T\u1EF7 l\u1EC7</th>
                                <th>Hoa h\u1ED3ng</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Web - User m\u1EDBi</td>
                                <td><span class="affiliate-rate-badge ${p(i.web_new_commission_rate)}">${i.web_new_commission_rate||"N/A"}</span></td>
                                <td>${i.web_new_commission||"N/A"}</td>
                            </tr>
                            <tr>
                                <td>Web - User c\u0169</td>
                                <td><span class="affiliate-rate-badge ${p(i.web_exist_commission_rate)}">${i.web_exist_commission_rate||"N/A"}</span></td>
                                <td>${i.web_exist_commission||"N/A"}</td>
                            </tr>
                            <tr>
                                <td>App - User m\u1EDBi</td>
                                <td><span class="affiliate-rate-badge ${p(i.app_new_commission_rate)}">${i.app_new_commission_rate||"N/A"}</span></td>
                                <td>${i.app_new_commission||"N/A"}</td>
                            </tr>
                            <tr>
                                <td>App - User c\u0169</td>
                                <td><span class="affiliate-rate-badge ${p(i.app_exist_commission_rate)}">${i.app_exist_commission_rate||"N/A"}</span></td>
                                <td>${i.app_exist_commission||"N/A"}</td>
                            </tr>
                            <tr>
                                <td>Platform - User m\u1EDBi</td>
                                <td><span class="affiliate-rate-badge ${p(i.new_platform_commission_rate)}">${i.new_platform_commission_rate||"N/A"}</span></td>
                                <td>-</td>
                            </tr>
                            <tr>
                                <td>Platform - User c\u0169</td>
                                <td><span class="affiliate-rate-badge ${p(i.exist_platform_commission_rate)}">${i.exist_platform_commission_rate||"N/A"}</span></td>
                                <td>-</td>
                            </tr>
                            ${i.commission_cap?`
                            <tr>
                                <td colspan="2"><strong>Gi\u1EDBi h\u1EA1n hoa h\u1ED3ng</strong></td>
                                <td><strong>${i.commission_cap}</strong></td>
                            </tr>
                            `:""}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Commission Details by Channel -->
            ${i.shopee_commission_detail?`
            <div class="affiliate-offer-card">
                <div class="affiliate-offer-card-header">
                    <span>\u{1F4F1}</span>
                    <span>Hoa h\u1ED3ng theo K\xEAnh</span>
                </div>
                <div class="affiliate-offer-card-body">
                    <div class="affiliate-channel-section">
                        <div class="affiliate-channel-grid">
                            ${Z(i.shopee_commission_detail)}
                        </div>
                    </div>
                </div>
            </div>
            `:""}

            <!-- Period Time -->
            ${e.period_start_time&&e.period_end_time?`
            <div class="affiliate-offer-card">
                <div class="affiliate-offer-card-header">
                    <span>\u23F0</span>
                    <span>Th\u1EDDi gian hi\u1EC7u l\u1EF1c</span>
                </div>
                <div class="affiliate-offer-card-body">
                    <div class="affiliate-period-info">
                        <div class="affiliate-period-label">B\u1EAFt \u0111\u1EA7u</div>
                        <div class="affiliate-period-value">${E(e.period_start_time)}</div>
                        <div class="affiliate-period-label" style="margin-top: 8px;">K\u1EBFt th\xFAc</div>
                        <div class="affiliate-period-value">${E(e.period_end_time)}</div>
                    </div>
                </div>
            </div>
            `:""}

        `}function Z(e){let t={"Shopee Video - Item Base - User m\u1EDBi":e.shopee_video_item_base_new_commission_rate,"Shopee Video - Item Base - User c\u0169":e.shopee_video_item_base_exist_commission_rate,"Shopee Video - Shop Base - User m\u1EDBi":e.shopee_video_shop_base_new_commission_rate,"Shopee Video - Shop Base - User c\u0169":e.shopee_video_shop_base_exist_commission_rate,"Live Streaming - Item Base - User m\u1EDBi":e.live_streaming_item_base_new_commission_rate,"Live Streaming - Item Base - User c\u0169":e.live_streaming_item_base_exist_commission_rate,"Live Streaming - Shop Base - User m\u1EDBi":e.live_streaming_shop_base_new_commission_rate,"Live Streaming - Shop Base - User c\u0169":e.live_streaming_shop_base_exist_commission_rate,"Social Media - Item Base - User m\u1EDBi":e.social_media_item_base_new_commission_rate,"Social Media - Item Base - User c\u0169":e.social_media_item_base_exist_commission_rate,"Social Media - Shop Base - User m\u1EDBi":e.social_media_shop_base_new_commission_rate,"Social Media - Shop Base - User c\u0169":e.social_media_shop_base_exist_commission_rate,"Social Media - Checkout Base - User m\u1EDBi":e.social_media_check_out_base_new_commission_rate,"Social Media - Checkout Base - User c\u0169":e.social_media_check_out_base_exist_commission_rate},i="";for(let[a,n]of Object.entries(t))n&&n!=="0%"&&n!==0&&(i+=`
                    <div class="affiliate-channel-card">
                        <div class="affiliate-channel-title">
                            ${ee(a)} ${a}
                        </div>
                        <div class="affiliate-channel-rate">${n}</div>
                    </div>
                `);return i||'<div style="color: #999; font-size: 13px;">Kh\xF4ng c\xF3 d\u1EEF li\u1EC7u</div>'}function ee(e){return e.includes("Shopee Video")?"\u{1F3A5}":e.includes("Live Streaming")?"\u{1F4FA}":e.includes("Social Media")?"\u{1F4F1}":"\u{1F4CA}"}function te(e,t){e.querySelectorAll("[data-copy]").forEach(i=>{i.addEventListener("click",function(){let a=this.getAttribute("data-copy"),n=document.getElementById(a);if(n&&D(n.value)){let s=this.textContent;this.textContent="\u2713 \u0110\xE3 copy!",this.style.background="#28a745",setTimeout(()=>{this.textContent=s,this.style.background=""},2e3)}})})}function ie(){let e=document.createElement("script");e.src=chrome.runtime.getURL("js/injected-product-offer.js"),e.onload=function(){o("injected-product-offer.js loaded."),this.remove()},e.onerror=function(){o("Failed to load injected-product-offer.js")},(document.head||document.documentElement).appendChild(e)}function ae(e,t,i,a="affiliate_offer"){!SERVER_CONFIG.enabled||!SERVER_CONFIG.serverUrl||chrome.storage.local.get(["productDataSharingEnabled"],n=>{if(!(n.productDataSharingEnabled!==!1)){o("Chia s\u1EBB d\u1EEF li\u1EC7u s\u1EA3n ph\u1EA9m \u0111\xE3 b\u1ECB t\u1EAFt, kh\xF4ng g\u1EEDi d\u1EEF li\u1EC7u");return}o("Chia s\u1EBB d\u1EEF li\u1EC7u s\u1EA3n ph\u1EA9m \u0111\xE3 \u0111\u01B0\u1EE3c b\u1EADt, \u0111ang g\u1EEDi d\u1EEF li\u1EC7u...");let d={url:i,api:t,data:e,timestamp:new Date().toISOString(),pageType:a};fetch(SERVER_CONFIG.serverUrl,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)}).then(r=>{r.ok?o("\u0110\xE3 g\u1EEDi d\u1EEF li\u1EC7u l\xEAn server th\xE0nh c\xF4ng"):o(`Server tr\u1EA3 v\u1EC1 l\u1ED7i: ${r.status}`)}).catch(r=>{o("L\u1ED7i khi g\u1EEDi d\u1EEF li\u1EC7u:",r)})})}function ne(e){if(!e)return;o("\u0110\xE3 nh\u1EADn \u0111\u01B0\u1EE3c d\u1EEF li\u1EC7u product offer t\u1EEB injected script:",e),window.SHOPEE_PRODUCT_OFFER_DATA=e,C=e;let t=window.location.href;ae(e,K,t,"affiliate_offer");let a=()=>{document.body?x(e):setTimeout(a,100)};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",a):setTimeout(a,500)}function se(){window.addEventListener("message",function(e){e.source===window&&e.data.type&&e.data.type==="SHOPEE_PRODUCT_OFFER_DATA"&&(o("Data received from injected script:",e.data.payload),ne(e.data.payload))})}let I=window.location.href,v=!1;function y(){let e=new URL(window.location.href);return e.pathname==="/dashboard"||e.pathname==="/dashboard/"}function $(){let e=window.location.href;if(e!==I)if(I=e,o("URL changed to:",e),v=!1,g=!1,y())L();else{let t=w();t&&t!==m&&(m=t,o(`New item_id detected: ${m}`),C=null,g=!1)}}function oe(){window.addEventListener("popstate",()=>{setTimeout($,100)});let e=history.pushState,t=history.replaceState;history.pushState=function(...n){e.apply(history,n),setTimeout($,100)},history.replaceState=function(...n){t.apply(history,n),setTimeout($,100)},setInterval($,1e3);let i=new MutationObserver(()=>{y()&&!v&&document.querySelector(".no-style-panel.dashboard-panel")&&(o("Dashboard panel detected via MutationObserver"),L())}),a=()=>{document.body?(i.observe(document.body,{childList:!0,subtree:!0}),o("Route change listener \u0111\xE3 \u0111\u01B0\u1EE3c thi\u1EBFt l\u1EADp")):document.readyState==="loading"?document.addEventListener("DOMContentLoaded",a):setTimeout(a,100)};a()}function re(){let e=()=>{let t=document.querySelector(".no-style-panel.dashboard-panel");if(!t){setTimeout(e,500);return}if(document.getElementById("shopee-mcn-manager-btn")||document.getElementById("shopee-order-analysis-btn"))return;let i=document.createElement("div");i.style.cssText=`
                display: flex;
                gap: 10px;
                margin: 10px 0;
            `;let a=document.createElement("button");a.id="shopee-mcn-manager-btn",a.textContent="Qu\u1EA3n L\xFD MCN",a.style.cssText=`
                display: inline-block;
                padding: 5px 10px;
                background-color: #000000;
                color: white;
                border: none;
                border-radius: 4px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                transition: background-color 0.2s;
            `,a.addEventListener("mouseenter",()=>{a.style.backgroundColor="#333333"}),a.addEventListener("mouseleave",()=>{a.style.backgroundColor="#333333"}),a.addEventListener("click",()=>{chrome.runtime.sendMessage({type:"OPEN_MCN_MANAGER"})});let n=document.createElement("button");n.id="shopee-order-analysis-btn",n.textContent="Ph\xE2n t\xEDch \u0111\u01A1n h\xE0ng",n.style.cssText=`
                display: inline-block;
                padding: 5px 10px;
                background-color: #ee4d2d;
                color: white;
                border: none;
                border-radius: 4px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                transition: background-color 0.2s;
            `,n.addEventListener("mouseenter",()=>{n.style.backgroundColor="#d73211"}),n.addEventListener("mouseleave",()=>{n.style.backgroundColor="#ee4d2d"}),n.addEventListener("click",()=>{chrome.runtime.sendMessage({type:"OPEN_ORDER_HISTORY"})});let s=document.createElement("button");s.id="shopee-click-analysis-btn",s.textContent="Ph\xE2n t\xEDch click",s.style.cssText=`
                display: inline-block;
                padding: 5px 10px;
                background-color: #0d6efd;
                color: white;
                border: none;
                border-radius: 4px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                transition: background-color 0.2s;
            `,s.addEventListener("mouseenter",()=>{s.style.backgroundColor="#0b5ed7"}),s.addEventListener("mouseleave",()=>{s.style.backgroundColor="#0d6efd"}),s.addEventListener("click",()=>{chrome.runtime.sendMessage({type:"OPEN_CLICK_OVERVIEW"})}),i.appendChild(a),i.appendChild(n),i.appendChild(s),t.appendChild(i),o("\u0110\xE3 th\xEAm n\xFAt 'Qu\u1EA3n L\xFD MCN', 'Ph\xE2n t\xEDch \u0111\u01A1n h\xE0ng' v\xE0 'Ph\xE2n t\xEDch click' v\xE0o dashboard")};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",e):e()}function L(){if(!y()){v=!1;return}v||(o("\u0110ang \u1EDF trang dashboard, th\xEAm n\xFAt ph\xE2n t\xEDch \u0111\u01A1n h\xE0ng..."),re(),v=!0)}async function T(){try{let t=await fetch("https://affiliate.shopee.vn/api/v3/report/list?page_size=1&page_num=1&version=1",{method:"GET",credentials:"include"});return t.status===401?!1:(t.ok,!0)}catch(e){return console.error("checkLoginStatus error:",e),!1}}window.addEventListener("message",e=>{if(e.source===window&&e.data.type==="BATCH_CUSTOM_LINK_RESPONSE"){let{requestId:t,result:i,error:a}=e.data;chrome.runtime.sendMessage({type:"BATCH_CUSTOM_LINK_RESULT",requestId:t,success:!a,data:i,error:a||null}).catch(n=>{console.error("Failed to forward result to background:",n)})}}),chrome.runtime.onMessage.addListener((e,t,i)=>{var n;let a=((n=t==null?void 0:t.tab)==null?void 0:n.id)||null;if(e.type==="GET_COOKIES"){let s=document.cookie;return i({cookies:s||""}),!0}else{if(e.type==="PING")return i({success:!0}),!0;if(e.type==="CHECK_LOGIN")return(async()=>{try{let s=await T();i({isLoggedIn:s})}catch(s){i({isLoggedIn:!1,error:s.message})}})(),!0;if(e.type==="EXECUTE_BATCH_CUSTOM_LINK")return(async()=>{try{let{requestId:s}=e;if(!await T()){chrome.runtime.sendMessage({type:"LOGIN_REQUIRED",requestId:s});return}chrome.runtime.sendMessage({type:"PROCEED_BATCH_CUSTOM_LINK",requestId:s})}catch(s){chrome.runtime.sendMessage({type:"BATCH_CUSTOM_LINK_RESULT",requestId:e.requestId,success:!1,error:s.message||"Unknown error"})}})(),!0}});function de(){if(oe(),y()){L();return}if(m=w(),!m){o("Kh\xF4ng t\xECm th\u1EA5y item_id trong URL. Script s\u1EBD kh\xF4ng ho\u1EA1t \u0111\u1ED9ng.");return}o(`Content script started for item_id: ${m}`),o(`Current URL: ${window.location.href}`),se(),ie(),o("\u0110\xE3 kh\u1EDFi t\u1EA1o content script, \u0111ang \u0111\u1EE3i d\u1EEF li\u1EC7u t\u1EEB injected script...")}de()})();})();

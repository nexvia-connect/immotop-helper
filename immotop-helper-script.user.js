// ==UserScript==
// @name         Immotop helper
// @namespace    http://tampermonkey.net/
// @version      6.2
// @description  Force highlight specific Immotop listings, find Nexvia links, and survive aggressive filters
// @match        https://pro.immotop.lu/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let targetIds = [];
    let downgradeId = null;
    let findId = null;

    const queryString = window.location.search.replace('?', '');
    const queryParams = queryString.split('&');

    const newIds = queryParams.filter(param => /^\d{6,8}$/.test(param));
    if (newIds.length > 0) {
        targetIds = newIds;
        sessionStorage.setItem('immotop_target_ids', JSON.stringify(targetIds));
    } else {
        const stored = sessionStorage.getItem('immotop_target_ids');
        if (stored) targetIds = JSON.parse(stored);
    }

    const downgradeParam = queryParams.find(param => param.startsWith('downgrade='));
    if (downgradeParam) {
        downgradeId = downgradeParam.split('=')[1];
        sessionStorage.setItem('immotop_downgrade_id', downgradeId);
    } else if (newIds.length > 0) {
        sessionStorage.removeItem('immotop_downgrade_id');
        downgradeId = null;
    } else {
        const storedDown = sessionStorage.getItem('immotop_downgrade_id');
        if (storedDown) downgradeId = storedDown;
    }

    const findParam = queryParams.find(param => param.startsWith('find='));
    if (findParam) {
        findId = findParam.split('=')[1];
        sessionStorage.setItem('immotop_find_id', findId);
    } else if (newIds.length > 0 || downgradeParam) {
        sessionStorage.removeItem('immotop_find_id');
        findId = null;
    } else {
        const storedFind = sessionStorage.getItem('immotop_find_id');
        if (storedFind) findId = storedFind;
    }

    if (targetIds.length === 0 && !downgradeId && !findId) return;

    function createPopup(url, imgSrc) {
        if (document.getElementById('immotop-find-popup')) return;

        const popup = document.createElement('div');
        popup.id = 'immotop-find-popup';
        popup.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            z-index: 100000; background: #1a1a1a; border-radius: 8px;
            border: 1px solid #333; box-shadow: 0 10px 30px rgba(0,0,0,0.8);
            font-family: system-ui, -apple-system, sans-serif; width: 420px;
        `;

        const imageHtml = imgSrc ? `
            <img src="${imgSrc}" style="width: 100%; height: 220px; object-fit: cover; border-radius: 6px; border: 1px solid #333; margin-bottom: 12px; display: block; box-sizing: border-box;">
        ` : '';

        popup.innerHTML = `
            <div id="immo-popup-header" style="cursor: grab; background: #2a2a2a; padding: 12px 16px; color: white; display: flex; justify-content: space-between; align-items: center; border-radius: 8px 8px 0 0; border-bottom: 1px solid #333;">
                <strong style="margin: 0; font-size: 14px; letter-spacing: 0.5px;">Listing Found</strong>
                <span id="immo-popup-close" style="cursor: pointer; font-size: 16px; line-height: 1; color: #888; transition: color 0.2s;">&#x2715;</span>
            </div>
            <div style="padding: 20px;">
                ${imageHtml}
                <div style="display: flex; gap: 8px; align-items: center; justify-content: center; box-sizing: border-box;">
                    <input type="text" id="immo-popup-input" value="${url}" readonly style="flex-grow: 1; padding: 10px 12px; border: 1px solid #333; background: #000; color: #333; border-radius: 6px; font-size: 13px; outline: none; box-sizing: border-box;" />
                    <button id="immo-popup-copy" style="background: #333; border: 1px solid #555; color: white; padding: 10px; cursor: pointer; border-radius: 6px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; box-sizing: border-box;" title="Copy to clipboard">
                        <svg id="immo-copy-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(popup);

        const closeBtn = document.getElementById('immo-popup-close');
        closeBtn.onmouseover = () => closeBtn.style.color = '#fff';
        closeBtn.onmouseout = () => closeBtn.style.color = '#888';
        closeBtn.onclick = () => popup.remove();

        const copyBtn = document.getElementById('immo-popup-copy');
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(url).then(() => {
                copyBtn.style.background = '#2e7d32';
                copyBtn.style.borderColor = '#2e7d32';
                copyBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                setTimeout(() => {
                    copyBtn.style.background = '#333';
                    copyBtn.style.borderColor = '#555';
                    copyBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
                }, 2000);
            });
        };

        const header = document.getElementById('immo-popup-header');
        let isDragging = false, startX, startY;

        const doDrag = (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            startX = e.clientX;
            startY = e.clientY;
            popup.style.left = (parseInt(popup.style.left, 10) + dx) + 'px';
            popup.style.top = (parseInt(popup.style.top, 10) + dy) + 'px';
        };

        const stopDrag = () => {
            isDragging = false;
            header.style.cursor = 'grab';
            window.removeEventListener('mousemove', doDrag);
            window.removeEventListener('mouseup', stopDrag);
        };

        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = popup.getBoundingClientRect();

            popup.style.transform = 'none';
            popup.style.left = rect.left + 'px';
            popup.style.top = rect.top + 'px';
            header.style.cursor = 'grabbing';

            window.addEventListener('mousemove', doDrag);
            window.addEventListener('mouseup', stopDrag);
        });
    }

    function enforceHighlights() {
        const containers = document.querySelectorAll('.search-agency-item-container');
        let triggerPopupUrl = null;
        let triggerPopupImg = null;

        containers.forEach(container => {
            const link = container.querySelector('a[href*="/annonces/"]');
            let matchType = null;
            let adId = null;

            if (link) {
                const match = link.href.match(/\/annonces\/(\d+)/);
                if (match && match[1]) {
                    adId = match[1];
                }
            }

            if (findId) {
                const desc = container.querySelector('.ad_desc');
                if (desc && desc.textContent.includes(`https://www.nexvia.lu/fr/buy/detail/${findId}`)) {
                    matchType = 'find';

                    if (adId && !document.getElementById('immotop-find-popup')) {
                        triggerPopupUrl = `https://www.immotop.lu/annonces/${adId}/`;

                        const imgEl = container.querySelector('.search-agency-item-image img');
                        if (imgEl) {
                            triggerPopupImg = imgEl.getAttribute('data-src') || imgEl.src;
                        }
                    }
                }
            }

            if (!matchType && adId) {
                if (targetIds.includes(adId)) {
                    matchType = 'highlight';
                } else if (adId === downgradeId) {
                    matchType = 'downgrade';
                }
            }

            if (matchType === 'find') {
                container.style.cssText = 'border: 4px solid #00E676 !important; box-sizing: border-box;';
            } else if (matchType === 'highlight') {
                container.style.cssText = 'border: 4px solid orange !important; box-sizing: border-box;';
            } else if (matchType === 'downgrade') {
                container.style.cssText = 'border: 4px solid red !important; box-sizing: border-box;';
            } else {
                if (container.style.border.includes('orange') || container.style.border.includes('red') || container.style.border.includes('rgb(0, 230, 118)')) {
                    container.style.cssText = '';
                }
            }
        });

        if (triggerPopupUrl) {
            createPopup(triggerPopupUrl, triggerPopupImg);
        }
    }

    enforceHighlights();

    const observer = new MutationObserver(() => {
        enforceHighlights();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setInterval(enforceHighlights, 500);

})();

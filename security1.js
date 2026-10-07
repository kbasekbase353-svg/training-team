(function() {
    // Security: Disable Right-click and Developer Shortcuts
    function applySecurityRestrictions() {
        // Disable Right-Click
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        }, false);

        // Disable Common Developer Shortcuts
        document.addEventListener('keydown', (e) => {
            // Disable F12
            if (e.key === 'F12' || e.keyCode === 123) {
                e.preventDefault();
                return false;
            }

            // Disable Ctrl+Shift+I (Inspector)
            // Disable Ctrl+Shift+J (Console)
            // Disable Ctrl+Shift+C (Element Selector)
            if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C' || e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) {
                e.preventDefault();
                return false;
            }

            // Disable Ctrl+U (View Source)
            if (e.ctrlKey && (e.key === 'u' || e.key === 'U' || e.keyCode === 85)) {
                e.preventDefault();
                return false;
            }

            // Disable Ctrl+S (Save Page)
            if (e.ctrlKey && (e.key === 's' || e.key === 'S' || e.keyCode === 83)) {
                e.preventDefault();
                return false;
            }
        });

        // Continuous check for DevTools window
        const devtools = {
            isOpen: false,
            orientation: undefined
        };
        const threshold = 160;
        const emitEvent = (isOpen, orientation) => {
            window.dispatchEvent(new CustomEvent('devtoolschange', {
                detail: {
                    isOpen,
                    orientation
                }
            }));
        };

        setInterval(() => {
            const widthThreshold = window.outerWidth - window.innerWidth > threshold;
            const heightThreshold = window.outerHeight - window.innerHeight > threshold;
            const orientation = widthThreshold ? 'vertical' : 'horizontal';

            if (!(heightThreshold && widthThreshold) &&
                ((window.Firebug && window.Firebug.chrome && window.Firebug.chrome.isInitialized) || widthThreshold || heightThreshold)) {
                if (!devtools.isOpen || devtools.orientation !== orientation) {
                    emitEvent(true, orientation);
                }
                devtools.isOpen = true;
                devtools.orientation = orientation;
            } else {
                if (devtools.isOpen) {
                    emitEvent(false, undefined);
                }
                devtools.isOpen = false;
                devtools.orientation = undefined;
            }
        }, 500);
    }

    // Run security restrictions immediately
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applySecurityRestrictions);
    } else {
        applySecurityRestrictions();
    }
})();

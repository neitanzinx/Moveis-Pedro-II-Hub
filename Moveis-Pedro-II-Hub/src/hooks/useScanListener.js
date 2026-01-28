import { useEffect, useState, useRef } from 'react';

export function useScanListener(onScan) {
    const [buffer, setBuffer] = useState('');
    const timeoutRef = useRef(null);

    useEffect(() => {
        const handleKeyDown = (e) => {
            // Ignore events initiated from input fields to prevent double submission/interference
            if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

            // Ignore specialized keys but keep alphanumeric
            if (e.key.length > 1 && e.key !== 'Enter') return;

            if (e.key === 'Enter') {
                if (buffer.length > 0) {
                    // Clean sanitation: remove anything that is not a number
                    const scannedCode = buffer.replace(/[^0-9]/g, '');
                    if (scannedCode) {
                        onScan(scannedCode);
                    }
                    setBuffer('');
                }
                return;
            }

            setBuffer(prev => prev + e.key);

            // Reset buffer if typing is too slow (manual entry vs scanner)
            // Scanners are usually very fast (<50ms between chars)
            // But we just use a simple timeout to clear stale buffers
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
                setBuffer('');
            }, 300); // 300ms idle clears buffer
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [buffer, onScan]);

    return buffer;
}

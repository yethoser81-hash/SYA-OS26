/**
 * SYA OS — Moteur d'Impression Universel
 * Gère le formatage et l'impression pour thermique (58mm/80mm) et A4.
 */

class SYAPrinterEngine {
    constructor() {
        this.config = JSON.parse(localStorage.getItem('sya_invoice_config')) || {
            name: "SUPERMARCHÉ SYA OS",
            header: "Alimentation Générale & Distribution",
            taxId: "M081912345678A",
            phone: "+237 600 00 00 00",
            address: "Douala, Cameroun",
            footer: "Les marchandises vendues ne sont ni reprises ni échangées. Merci !",
            format: "80mm"
        };
    }

    generateReceiptHTML(saleData) {
        const itemsHTML = (saleData.items || []).map(item => `
            <tr>
                <td style="padding: 2px 0;">${item.name}</td>
                <td style="text-align: center; padding: 2px 0;">${item.qty}</td>
                <td style="text-align: right; padding: 2px 0;">${(item.qty * item.price).toLocaleString()}</td>
            </tr>
        `).join('');

        return `
            <div class="sya-printable-receipt format-${this.config.format}">
                <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px;">
                    <h3 style="margin: 0; font-size: 15px;">${this.config.name}</h3>
                    <div style="font-size: 11px;">${this.config.header}</div>
                    <div style="font-size: 10px;">NIU: ${this.config.taxId} | Tél: ${this.config.phone}</div>
                </div>

                <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 5px;">
                    <span>Ref: ${saleData.ticket_ref}</span>
                    <span>${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}</span>
                </div>

                <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 5px;">
                    <thead>
                        <tr style="border-bottom: 1px solid #000;">
                            <th style="text-align: left;">Article</th>
                            <th style="text-align: center;">Qté</th>
                            <th style="text-align: right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHTML}
                    </tbody>
                </table>

                <div style="border-top: 1px dashed #000; padding-top: 4px; text-align: right; font-weight: bold; font-size: 14px;">
                    TOTAL: ${(saleData.total || 0).toLocaleString()} FCFA
                </div>

                <div style="text-align: center; margin-top: 10px; border-top: 1px dashed #000; padding-top: 6px;">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${saleData.ticket_ref}" style="width: 80px; height: 80px;" />
                    <div style="font-size: 8px; margin-top: 2px;">Vérification Sortie — SYA OS Security</div>
                </div>

                <div style="text-align: center; margin-top: 6px; font-size: 9px; font-style: italic;">
                    ${this.config.footer}
                </div>
            </div>
        `;
    }

    print(saleData) {
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        const content = this.generateReceiptHTML(saleData);

        printWindow.document.write(`
            <html>
                <head>
                    <title>Impression Ticket - ${saleData.ticket_ref}</title>
                    <style>
                        body { font-family: monospace; font-size: 12px; margin: 0; padding: 10px; }
                        @media print {
                            body { padding: 0; }
                            .sya-printable-receipt { width: 100%; }
                        }
                    </style>
                </head>
                <body>
                    ${content}
                    <script>
                        window.onload = function() {
                            window.print();
                            setTimeout(function() { window.close(); }, 500);
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    }
}

window.SYAPrinterEngine = SYAPrinterEngine;
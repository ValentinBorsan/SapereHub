const nodemailer = require('nodemailer');

// Configurare transportator (folosește variabile de mediu în producție!)
// Asigură-te că ai setat variabilele SMTP în .env
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp-relay.brevo.com', // Default Brevo
    port: process.env.SMTP_PORT || 465,
    secure: true, // true pentru 465, false pentru alte porturi
    auth: {
        user: process.env.SMTP_USER, // Adresa de login SMTP (ex: user@gmail.com sau user@brevo.com)
        pass: process.env.SMTP_PASS  // Parola SMTP (App Password sau API Key)
    }
});

const sendContactEmail = async (data) => {
    // 1. Definim variabilele necesare pentru template
    const currentYear = new Date().getFullYear();
    const logoUrl = "https://firebasestorage.googleapis.com/v0/b/valentin-borsan-website-9956a.firebasestorage.app/o/Logo%2Flogo-sapere1.png?alt=media&token=7363232f-d42b-45e0-8b3d-53286ba91369";
    const siteUrl = "https://sapereplus.it"; // URL-ul site-ului tău

    // 2. Construim HTML-ul folosind noul template
    // Am înlocuit {{params...}} cu variabilele JS reale din 'data'
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="it">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Mesaj Nou de Contact</title>
        <style>
            /* Reseturi de bază pentru clienții de email */
            body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: #0f172a; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
            img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; display: block; }
            table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
            
            /* Stiluri Responsive */
            @media only screen and (max-width: 600px) {
                .container { width: 100% !important; max-width: 100% !important; border-radius: 0 !important; }
                .content-padding { padding: 20px !important; }
                .header-padding { padding: 30px 20px !important; }
                .mobile-font { font-size: 16px !important; }
            }
        </style>
    </head>
    <body style="background-color: #0f172a; margin: 0; padding: 0;">
        
        <!-- Wrapper Principal (Centrat) -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0f172a;">
            <tr>
                <td align="center" style="padding: 40px 10px;">
                    
                    <!-- Container Card (Alb/Gri închis) -->
                    <table border="0" cellpadding="0" cellspacing="0" width="600" class="container" style="background-color: #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.4); border: 1px solid #334155;">
                        
                        <!-- HEADER -->
                        <tr>
                            <td align="center" class="header-padding" style="padding: 40px 30px; background-color: #0f172a; border-bottom: 3px solid #f59e0b;">
                                <a href="${siteUrl}" target="_blank" style="text-decoration: none;">
                                    <!-- LOGO-ul Tău -->
                                    <img src="${logoUrl}" 
                                         alt="SaperePlus" 
                                         width="180" 
                                         style="width: 180px; max-width: 100%; display: block; border: 0;">
                                </a>
                            </td>
                        </tr>

                        <!-- CONTENT -->
                        <tr>
                            <td class="content-padding" style="padding: 40px 30px;">
                                
                                <!-- Titlu -->
                                <h1 style="margin: 0 0 20px 0; color: #ffffff; font-size: 24px; font-weight: bold; text-align: center;">
                                    Mesaj Nou de Contact
                                </h1>

                                <!-- Intro Text -->
                                <p class="mobile-font" style="margin: 0 0 30px 0; color: #94a3b8; font-size: 16px; line-height: 1.6; text-align: center;">
                                    Ai primit o solicitare nouă prin formularul de pe site.
                                </p>

                                <!-- Cutia cu Detalii (Highlight) -->
                                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #27354f; border-radius: 12px; border-left: 4px solid #f59e0b;">
                                    <tr>
                                        <td style="padding: 25px;">
                                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                                <tr>
                                                    <td style="padding-bottom: 15px; border-bottom: 1px solid #3d4f6e;">
                                                        <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">Expeditor</p>
                                                        <p style="margin: 5px 0 0 0; color: #ffffff; font-size: 18px; font-weight: bold;">
                                                            ${data.firstName} ${data.lastName}
                                                        </p>
                                                        <a href="mailto:${data.email}" style="color: #f59e0b; text-decoration: none; font-size: 14px; display: inline-block; margin-top: 4px;">
                                                            ${data.email}
                                                        </a>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style="padding-top: 20px;">
                                                        <p style="margin: 0 0 10px 0; color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">Mesaj</p>
                                                        <p style="margin: 0; color: #e2e8f0; font-size: 16px; line-height: 1.6; font-style: italic;">
                                                            "${data.message.replace(/\n/g, '<br>')}"
                                                        </p>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>

                                <!-- Buton Acțiune (Reply) -->
                                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 35px;">
                                    <tr>
                                        <td align="center">
                                            <a href="mailto:${data.email}" style="background-color: #f59e0b; color: #ffffff; padding: 14px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);">
                                                Răspunde Acum
                                            </a>
                                        </td>
                                    </tr>
                                </table>

                            </td>
                        </tr>

                        <!-- FOOTER -->
                        <tr>
                            <td align="center" style="padding: 25px; background-color: #172033; border-top: 1px solid #334155;">
                                <p style="margin: 0 0 10px 0; color: #64748b; font-size: 12px;">
                                    Acest email a fost trimis automat de pe platforma 
                                    <strong style="color: #f59e0b;">SaperePlus</strong>.
                                </p>
                                <p style="margin: 0; color: #475569; font-size: 11px;">
                                    &copy; ${currentYear} SaperePlus. Toate drepturile rezervate.
                                </p>
                            </td>
                        </tr>

                    </table>
                    <!-- End Container -->

                </td>
            </tr>
        </table>

    </body>
    </html>
    `;

    // 3. Configurare opțiuni email
    const mailOptions = {
        from: `"SaperePlus Contact" <${process.env.EMAIL_FROM}>`, // Apare ca fiind trimis de platformă (contact@sapereplus.it)
        to: process.env.EMAIL_TO, // Ajunge la tine în Gmail (adresa personală)
        replyTo: data.email, // Când dai REPLY din Gmail, răspunzi direct utilizatorului
        subject: `[Mesaj Nou] ${data.firstName} ${data.lastName}`,
        text: `
            Ai primit un mesaj nou de pe SaperePlus.
            
            Nume: ${data.firstName} ${data.lastName}
            Email: ${data.email}
            
            Mesaj:
            ${data.message}
        `, // Versiunea text simplu (fallback)
        html: htmlContent // Versiunea HTML frumoasă
    };

    // 4. Trimitere efectivă
    try {
        await transporter.sendMail(mailOptions);
        console.log('Email trimis cu succes prin SMTP');
        return { success: true };
    } catch (error) {
        console.error('Eroare SMTP:', error);
        return { success: false, error };
    }
};

module.exports = {
    sendContactEmail
};
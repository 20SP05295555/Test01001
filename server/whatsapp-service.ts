import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import QRCode from 'qrcode';

export type WhatsAppStatus = 'DISCONNECTED' | 'INITIALIZING' | 'QR_READY' | 'AUTHENTICATING' | 'READY' | 'PUPPETEER_ERROR';

class WhatsAppService {
  public status: WhatsAppStatus = 'DISCONNECTED';
  public qrCodeDataUrl: string | null = null;
  public qrText: string | null = null;
  public lastError: string | null = null;
  public client: any = null;
  public myNumber: string | null = null;

  constructor() {}

  public async initialize() {
    if (this.client) {
      if (this.status === 'READY' || this.status === 'INITIALIZING' || this.status === 'QR_READY') {
        console.log('[WhatsApp Service] Client is already running/connecting. Status:', this.status);
        return;
      }
      try {
        await this.client.destroy();
      } catch (e) {}
    }

    this.status = 'INITIALIZING';
    this.qrCodeDataUrl = null;
    this.qrText = null;
    this.lastError = null;

    try {
      console.log('[WhatsApp Service] Starting a new browser with Puppeteer...');
      this.client = new Client({
        authStrategy: new LocalAuth({
          clientId: 'whatsapp-checker-session',
          dataPath: './.wwebjs_auth'
        }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
          ],
          handleSIGINT: false,
          handleSIGTERM: false,
        }
      });

      this.client.on('qr', async (qr: string) => {
        this.status = 'QR_READY';
        this.qrText = qr;
        try {
          this.qrCodeDataUrl = await QRCode.toDataURL(qr);
        } catch (err: any) {
          console.error('[WhatsApp Service] QR Code translation failed:', err);
        }
        console.log('[WhatsApp Service] QR Code received. Awaiting scan...');
      });

      this.client.on('authenticated', () => {
        this.status = 'AUTHENTICATING';
        this.qrCodeDataUrl = null;
        this.qrText = null;
        console.log('[WhatsApp Service] Connected successfully to WhatsApp');
      });

      this.client.on('auth_failure', (msg: string) => {
        this.status = 'DISCONNECTED';
        this.lastError = `Authentication Failure: ${msg}`;
        console.error('[WhatsApp Service] Authentication error details:', msg);
      });

      this.client.on('ready', async () => {
        this.status = 'READY';
        this.qrCodeDataUrl = null;
        this.qrText = null;
        try {
          this.myNumber = this.client.info?.wid?.user || 'Connected session';
        } catch (e) {
          this.myNumber = 'Connected session';
        }
        console.log('[WhatsApp Service] Session is active and ready for queries. wid:', this.myNumber);
      });

      this.client.on('disconnected', (reason: string) => {
        console.log('[WhatsApp Service] Disconnected. Reason:', reason);
        this.status = 'DISCONNECTED';
        this.qrCodeDataUrl = null;
        this.qrText = null;
        this.myNumber = null;
      });

      // Launch and start the process asynchronously without blocking the server init thread
      this.client.initialize().catch((err: any) => {
        this.status = 'PUPPETEER_ERROR';
        this.lastError = err.message || 'Browser failed to initialize';
        console.error('[WhatsApp Service] client.initialize catch:', err);
      });

    } catch (err: any) {
      this.status = 'PUPPETEER_ERROR';
      this.lastError = err.message || 'Web browser failure during instantiation';
      console.error('[WhatsApp Service] Setup failed:', err);
    }
  }

  public async disconnect() {
    console.log('[WhatsApp Service] Requesting complete session disconnect');
    if (this.client) {
      try {
        await this.client.logout();
      } catch (e) {}
      try {
        await this.client.destroy();
      } catch (e) {}
      this.client = null;
    }
    this.status = 'DISCONNECTED';
    this.qrCodeDataUrl = null;
    this.qrText = null;
    this.myNumber = null;
  }

  public async verifyNumber(phone: string): Promise<{ hasWhatsApp: boolean; details?: string }> {
    if (this.status !== 'READY' || !this.client) {
      throw new Error("WhatsApp Web client is not connected. Please scan the QR code first.");
    }

    try {
      // Standard digits normalization
      let cleanPhone = phone.replace(/\D/g, '');
      if (!cleanPhone) {
        return { hasWhatsApp: false, details: 'Input does not contain digits' };
      }

      console.log(`[WhatsApp Service] Checking on-network presence of number: ${cleanPhone}`);
      const info = await this.client.getNumberId(cleanPhone);
      if (info && info._serialized) {
        return { 
          hasWhatsApp: true, 
          details: `Active WhatsApp Web Protocol match (ID: ${info._serialized})` 
        };
      } else {
        return { 
          hasWhatsApp: false, 
          details: 'Verified not active on WhatsApp Web protocol check.' 
        };
      }
    } catch (err: any) {
      console.error(`[WhatsApp Service] Check failure for number ${phone}:`, err);
      throw err;
    }
  }
}

export const whatsappService = new WhatsAppService();

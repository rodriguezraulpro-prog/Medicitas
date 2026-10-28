import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_FILE_PATH = path.resolve(__dirname, 'cloud-config.json');
const PUBLIC_CONFIG_FILE_PATH = path.resolve(__dirname, 'public', 'cloud-config.json');
const DIST_CONFIG_FILE_PATH = path.resolve(__dirname, 'dist', 'cloud-config.json');
const LEGACY_CONFIG_FILE_PATH = path.resolve(__dirname, 'supabase-config.json');

// Remove legacy config file if it exists so template starts completely blank
try {
  if (fs.existsSync(LEGACY_CONFIG_FILE_PATH)) {
    fs.unlinkSync(LEGACY_CONFIG_FILE_PATH);
  }
} catch {
  // ignore
}

interface SupabaseServerConfig {
  url: string;
  anonKey: string;
}

// Helper to read current Cloud server configuration
function readSupabaseConfig(): SupabaseServerConfig {
  const candidatePaths = [CONFIG_FILE_PATH, PUBLIC_CONFIG_FILE_PATH];
  for (const filePath of candidatePaths) {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        if (parsed.url && parsed.anonKey) {
          return {
            url: String(parsed.url).trim(),
            anonKey: String(parsed.anonKey).trim(),
          };
        }
      }
    } catch (err) {
      console.warn(`Could not read ${filePath}:`, err);
    }
  }

  // Fallback to environment variables if configured
  const envUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const envKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  if (envUrl && envKey && !envUrl.includes('your-project-id')) {
    return {
      url: envUrl.trim(),
      anonKey: envKey.trim(),
    };
  }

  // Start completely blank as a clean template
  return {
    url: '',
    anonKey: '',
  };
}

// Helper to save Supabase server configuration to root, public, and dist so static exports also get it
function saveSupabaseConfig(config: SupabaseServerConfig): boolean {
  try {
    const jsonPayload = JSON.stringify(
      {
        url: config.url.trim(),
        anonKey: config.anonKey.trim(),
        updatedAt: new Date().toISOString(),
      },
      null,
      2
    );

    fs.writeFileSync(CONFIG_FILE_PATH, jsonPayload, 'utf-8');

    try {
      fs.mkdirSync(path.dirname(PUBLIC_CONFIG_FILE_PATH), { recursive: true });
      fs.writeFileSync(PUBLIC_CONFIG_FILE_PATH, jsonPayload, 'utf-8');
    } catch (e) {
      console.warn('Could not write public/cloud-config.json:', e);
    }

    try {
      if (fs.existsSync(path.dirname(DIST_CONFIG_FILE_PATH))) {
        fs.writeFileSync(DIST_CONFIG_FILE_PATH, jsonPayload, 'utf-8');
      }
    } catch {
      // ignore
    }

    return true;
  } catch (err) {
    console.error('Failed to write cloud-config.json:', err);
    return false;
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(express.json());

  // API Route: Get Supabase configuration for all clients (PCs, phones, tablets)
  app.get('/api/config/supabase', (_req, res) => {
    const config = readSupabaseConfig();
    res.json({
      url: config.url,
      anonKey: config.anonKey,
      configured: Boolean(config.url && config.anonKey),
    });
  });

  // API Route: Save Supabase configuration from admin panel
  app.post('/api/config/supabase', (req, res) => {
    const { url, anonKey } = req.body || {};

    if (typeof url !== 'string' || typeof anonKey !== 'string') {
      res.status(400).json({ success: false, message: 'URL y Anon Key son requeridos.' });
      return;
    }

    const saved = saveSupabaseConfig({ url, anonKey });
    if (!saved) {
      res.status(500).json({ success: false, message: 'No se pudo guardar la configuración en el servidor.' });
      return;
    }

    res.json({
      success: true,
      message: 'Configuración guardada en el servidor. Ahora todos los dispositivos (móviles y PC) se sincronizan con la misma base de datos.',
      configured: Boolean(url && anonKey),
    });
  });

  // API Route: Clear Cloud configuration (revert to local)
  app.delete('/api/config/supabase', (_req, res) => {
    try {
      saveSupabaseConfig({ url: '', anonKey: '' });
      res.json({ success: true, message: 'Configuración de la Nube eliminada del servidor.' });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Error al eliminar configuración.' });
    }
  });

  // Vite middleware in dev or static files in production
  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    // Production: serve built files from dist
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));

    app.get('/admin', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'admin.html'));
    });

    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT} (Production: ${isProduction})`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

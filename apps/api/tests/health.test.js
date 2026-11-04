import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { parseEnv } from '../src/config/env.js';
describe('API foundation without a database', () => {
  it('returns the exact health contract', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200)
      .expect('Content-Type', /json/);
    expect(response.body).toEqual({ status: 'ok', service: 'easyfinance-api' });
  });
  it('allows the configured local browser origin', async () => {
    const response = await request(app)
      .get('/api/health')
      .set('Origin', 'http://localhost:5173');
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
  });
  it('does not grant an arbitrary browser origin', async () => {
    const response = await request(app)
      .get('/api/health')
      .set('Origin', 'https://untrusted.example');
    expect(response.headers['access-control-allow-origin']).not.toBe(
      'https://untrusted.example',
    );
  });
  it('returns a JSON 404', async () => {
    await request(app).get('/api/missing').expect(404, { error: 'Not found' });
  });
  it('handles malformed JSON without exposing internals', async () => {
    await request(app)
      .post('/api/missing')
      .set('Content-Type', 'application/json')
      .send('{')
      .expect(400, { error: 'Invalid JSON' });
  });
  it('validates environment configuration', () => {
    expect(() => parseEnv({ API_PORT: 'invalid' })).toThrow('API_PORT');
    expect(() => parseEnv({ WEB_ORIGIN: 'https://example.com/path' })).toThrow(
      'WEB_ORIGIN',
    );
    expect(parseEnv({})).toMatchObject({ port: 3001, nodeEnv: 'development' });
  });
});

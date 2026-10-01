import { describe, expect, it } from 'vitest';
import { googleCredentials } from '../src/server/google-auth';

describe('Google OAuth configuration', () => {
  it('stays disabled unless both credentials are present', () => {
    expect(googleCredentials({})).toBeUndefined();
    expect(googleCredentials({ GOOGLE_CLIENT_ID: 'id' })).toBeUndefined();
    expect(googleCredentials({ GOOGLE_CLIENT_SECRET: 'secret' })).toBeUndefined();
    expect(
      googleCredentials({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: '  ' }),
    ).toBeUndefined();
  });
  it('uses trimmed server credentials', () => {
    expect(
      googleCredentials({ GOOGLE_CLIENT_ID: ' id ', GOOGLE_CLIENT_SECRET: ' secret ' }),
    ).toEqual({ clientId: 'id', clientSecret: 'secret' });
  });
});

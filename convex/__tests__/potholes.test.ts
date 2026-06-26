/**
 * Convex pothole mutation/query tests.
 *
 * These tests use convex-test, an in-memory Convex backend for unit tests.
 * They verify the role-based authorization rules in convex/potholes.ts and
 * convex/users.ts — the rules that prevent a citizen from mutating municipal
 * state, or an unauthenticated caller from listing any data.
 *
 * Run with: npm test
 */
import { describe, it, expect } from 'vitest';
import { convexTest } from 'convex-test';
import schema from '../schema';
import { api, internal } from '../_generated/api';
// Static imports of the modules under test so convex-test can wire them up.
import * as potholesModule from '../potholes';
import * as usersModule from '../users';
import * as permittedUsersModule from '../permittedUsers';
import * as generatedApi from '../_generated/api';

const modules = {
  '../potholes.ts': () => Promise.resolve(potholesModule),
  '../users.ts': () => Promise.resolve(usersModule),
  '../permittedUsers.ts': () => Promise.resolve(permittedUsersModule),
  '../_generated/api.ts': () => Promise.resolve(generatedApi),
};

type TestConvex = ReturnType<typeof convexTest>;

async function signIn(t: TestConvex, role: 'citizen' | 'municipal' | 'admin') {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert('users', {
      name: `${role} tester`,
      email: `${role}@example.com`,
      emailVerificationTime: Date.now(),
    } as unknown as Record<string, unknown>);
    await ctx.db.insert('profiles', {
      userId,
      email: `${role}@example.com`,
      role,
      name: `${role} tester`,
    });
    return {
      userId,
      identity: {
        subject: userId,
        tokenIdentifier: `test|${userId}`,
        issuer: 'test',
        name: `${role} tester`,
      },
    };
  });
}

function setup() {
  return convexTest(schema, modules);
}

describe('potholes.report', () => {
  it('creates a row when called by a citizen', async () => {
    const t = setup();
    const { identity } = await signIn(t, 'citizen');
    const asUser = t.withIdentity(identity);

    const potholeId = await asUser.mutation(api.potholes.report, {
      latitude: 12.97,
      longitude: 77.59,
      severity: 'high',
      address: 'Test St',
    });

    const row = await asUser.query(api.potholes.getById, { potholeId });
    expect(row).toMatchObject({
      latitude: 12.97,
      longitude: 77.59,
      severity: 'high',
      status: 'reported',
    });
  });

  it('throws when called by an unauthenticated user', async () => {
    const t = setup();
    await expect(
      t.mutation(api.potholes.report, {
        latitude: 0,
        longitude: 0,
        severity: 'low',
      })
    ).rejects.toThrow();
  });
});

describe('potholes.updateStatus (role enforcement)', () => {
  it('rejects a citizen trying to change status', async () => {
    const t = setup();
    const citizen = await signIn(t, 'citizen');
    const asCitizen = t.withIdentity(citizen.identity);

    const potholeId = await asCitizen.mutation(api.potholes.report, {
      latitude: 0,
      longitude: 0,
      severity: 'low',
    });

    await expect(
      asCitizen.mutation(api.potholes.updateStatus, {
        potholeId,
        status: 'resolved',
      })
    ).rejects.toThrow(/Unauthorized/i);
  });

  it('allows a municipal user to mark a pothole resolved', async () => {
    const t = setup();
    const citizen = await signIn(t, 'citizen');
    const municipal = await signIn(t, 'municipal');

    const potholeId = await t
      .withIdentity(citizen.identity)
      .mutation(api.potholes.report, {
        latitude: 0,
        longitude: 0,
        severity: 'medium',
      });

    await t
      .withIdentity(municipal.identity)
      .mutation(api.potholes.updateStatus, {
        potholeId,
        status: 'resolved',
      });

    const row = await t
      .withIdentity(municipal.identity)
      .query(api.potholes.getById, { potholeId });
    expect(row?.status).toBe('resolved');
  });
});

describe('potholes.deletePothole (admin only)', () => {
  it('rejects a citizen trying to delete', async () => {
    const t = setup();
    const citizen = await signIn(t, 'citizen');
    const asCitizen = t.withIdentity(citizen.identity);

    const potholeId = await asCitizen.mutation(api.potholes.report, {
      latitude: 0,
      longitude: 0,
      severity: 'low',
    });

    await expect(
      asCitizen.mutation(api.potholes.deletePothole, { potholeId })
    ).rejects.toThrow(/Unauthorized/i);
  });

  it('allows admin to delete any pothole', async () => {
    const t = setup();
    const citizen = await signIn(t, 'citizen');
    const admin = await signIn(t, 'admin');

    const potholeId = await t
      .withIdentity(citizen.identity)
      .mutation(api.potholes.report, {
        latitude: 0,
        longitude: 0,
        severity: 'low',
      });

    await t
      .withIdentity(admin.identity)
      .mutation(api.potholes.deletePothole, { potholeId });

    const row = await t
      .withIdentity(admin.identity)
      .query(api.potholes.getById, { potholeId });
    expect(row).toBeNull();
  });
});

describe('potholes.applyAiResult (internal)', () => {
  it('writes aiVerified + status updates to "verified"', async () => {
    const t = setup();
    const { identity } = await signIn(t, 'citizen');

    const potholeId = await t
      .withIdentity(identity)
      .mutation(api.potholes.report, {
        latitude: 0,
        longitude: 0,
        severity: 'high',
      });

    await t.mutation(internal.potholes.applyAiResult, {
      potholeId,
      aiVerified: true,
      aiDescription: 'AI sees a pothole',
      aiDepthEstimate: '5-10 cm',
      aiSeverityConfidence: 'high (90%)',
    });

    const row = await t
      .withIdentity(identity)
      .query(api.potholes.getById, { potholeId });
    expect(row?.status).toBe('verified');
    expect(row?.aiVerified).toBe(true);
    expect(row?.aiDepthEstimate).toBe('5-10 cm');
  });

  it('marks status "dismissed" when aiVerified is false', async () => {
    const t = setup();
    const { identity } = await signIn(t, 'citizen');

    const potholeId = await t
      .withIdentity(identity)
      .mutation(api.potholes.report, {
        latitude: 0,
        longitude: 0,
        severity: 'low',
      });

    await t.mutation(internal.potholes.applyAiResult, {
      potholeId,
      aiVerified: false,
      aiDescription: 'Not a pothole',
      aiDepthEstimate: null,
      aiSeverityConfidence: null,
    });

    const row = await t
      .withIdentity(identity)
      .query(api.potholes.getById, { potholeId });
    expect(row?.status).toBe('dismissed');
    expect(row?.aiVerified).toBe(false);
  });
});

describe('potholes.list visibility', () => {
  it('citizen sees only their own reports', async () => {
    const t = setup();
    const alice = await signIn(t, 'citizen');
    const bob = await signIn(t, 'citizen');

    await t.withIdentity(alice.identity).mutation(api.potholes.report, {
      latitude: 1, longitude: 1, severity: 'low',
    });
    await t.withIdentity(bob.identity).mutation(api.potholes.report, {
      latitude: 2, longitude: 2, severity: 'high',
    });

    const aliceList = await t
      .withIdentity(alice.identity)
      .query(api.potholes.list, {});
    expect(aliceList).toHaveLength(1);
    expect(aliceList[0]?.latitude).toBe(1);
  });

  it('municipal sees all reports via listAll', async () => {
    const t = setup();
    const alice = await signIn(t, 'citizen');
    const bob = await signIn(t, 'citizen');
    const muni = await signIn(t, 'municipal');

    await t.withIdentity(alice.identity).mutation(api.potholes.report, {
      latitude: 1, longitude: 1, severity: 'low',
    });
    await t.withIdentity(bob.identity).mutation(api.potholes.report, {
      latitude: 2, longitude: 2, severity: 'high',
    });

    const muniList = await t
      .withIdentity(muni.identity)
      .query(api.potholes.listAll, {});
    expect(muniList).toHaveLength(2);
  });

  it('citizen calling listAll gets an empty list', async () => {
    const t = setup();
    const citizen = await signIn(t, 'citizen');
    const list = await t
      .withIdentity(citizen.identity)
      .query(api.potholes.listAll, {});
    expect(list).toEqual([]);
  });
});
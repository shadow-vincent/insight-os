/**
 * Config 模块测试
 *
 * node --test tests/config.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskApiKey, sanitize } from '../packages/core/src/config.ts';

test('maskApiKey: 标准 key 脱敏（保留前 4 后 4）', () => {
  assert.equal(maskApiKey('sk-1234567890abcdef'), 'sk-1****cdef');
});

test('maskApiKey: 短 key 全部星号', () => {
  assert.equal(maskApiKey('sk-12'), '****');
  assert.equal(maskApiKey('abcd'), '****');
  assert.equal(maskApiKey('12345678'), '****'); // 正好 8 位
});

test('maskApiKey: 空 key 返回空字符串', () => {
  assert.equal(maskApiKey(''), '');
});

test('sanitize: 完整 config 脱敏', () => {
  const sanitized = sanitize({
    llm: {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-1234567890abcdefghij',
      model: 'gpt-4o-mini',
      enabled: true,
    },
    paths: { vaultPath: '/Users/v/test' },
    lastUpdated: 1234567890,
  });

  // 不返回 apiKey 字段
  assert.equal(sanitized.llm.apiKey, undefined);
  // 返回脱敏后的 key
  assert.equal(sanitized.llm.apiKeyMasked, 'sk-1****ghij');
  // 其他字段保留
  assert.equal(sanitized.llm.baseUrl, 'https://api.openai.com/v1');
  assert.equal(sanitized.llm.model, 'gpt-4o-mini');
  assert.equal(sanitized.llm.enabled, true);
  assert.equal(sanitized.paths.vaultPath, '/Users/v/test');
});

test('sanitize: apiKeyConfigured 反映真实状态', () => {
  const s1 = sanitize({
    llm: { baseUrl: '', apiKey: 'sk-real-key', model: '', enabled: false },
    paths: { vaultPath: '' },
    lastUpdated: 0,
  });
  assert.equal(s1.llm.apiKeyConfigured, true);

  const s2 = sanitize({
    llm: { baseUrl: '', apiKey: '', model: '', enabled: false },
    paths: { vaultPath: '' },
    lastUpdated: 0,
  });
  assert.equal(s2.llm.apiKeyConfigured, false);

  // placeholder 视为未配置
  const s3 = sanitize({
    llm: { baseUrl: '', apiKey: 'sk-placeholder', model: '', enabled: false },
    paths: { vaultPath: '' },
    lastUpdated: 0,
  });
  assert.equal(s3.llm.apiKeyConfigured, false);
});

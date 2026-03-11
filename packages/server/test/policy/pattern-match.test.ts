import { describe, expect, test } from 'bun:test';
import {
	matchesPattern,
	matchesAnyPattern,
} from '../../src/policy/pattern-match.ts';

describe('matchesPattern', () => {
	test('exact match succeeds', () => {
		expect(matchesPattern('temporal.workflow.list', 'temporal.workflow.list')).toBe(true);
	});

	test('exact match fails when names differ', () => {
		expect(matchesPattern('temporal.workflow.list', 'temporal.workflow.describe')).toBe(false);
	});

	test('single wildcard * matches one segment', () => {
		expect(matchesPattern('temporal.workflow.list', 'temporal.workflow.*')).toBe(true);
	});

	test('single wildcard * matches a different single segment', () => {
		expect(matchesPattern('temporal.workflow.describe', 'temporal.workflow.*')).toBe(true);
	});

	test('single wildcard * does NOT match multiple segments', () => {
		expect(matchesPattern('temporal.workflow.history.get', 'temporal.workflow.*')).toBe(false);
	});

	test('double wildcard ** matches multiple segments', () => {
		expect(matchesPattern('temporal.workflow.history.get', 'temporal.**')).toBe(true);
	});

	test('double wildcard ** matches a single trailing segment', () => {
		expect(matchesPattern('temporal.workflow', 'temporal.**')).toBe(true);
	});

	test('double wildcard ** matches many trailing segments', () => {
		expect(matchesPattern('temporal.workflow.list', 'temporal.**')).toBe(true);
	});

	test('double wildcard ** does NOT match zero segments', () => {
		expect(matchesPattern('temporal', 'temporal.**')).toBe(false);
	});

	test('pattern with no wildcards requires exact match', () => {
		expect(matchesPattern('temporal.workflow.list', 'temporal.workflow.list')).toBe(true);
		expect(matchesPattern('temporal.workflow.list', 'temporal.workflow')).toBe(false);
	});

	test('wildcard in the middle of a pattern', () => {
		expect(matchesPattern('temporal.workflow.list', 'temporal.*.list')).toBe(true);
		expect(matchesPattern('temporal.schedule.list', 'temporal.*.list')).toBe(true);
		expect(matchesPattern('temporal.workflow.describe', 'temporal.*.list')).toBe(false);
	});

	test('double wildcard in the middle of a pattern', () => {
		expect(matchesPattern('temporal.workflow.history.get', 'temporal.**.get')).toBe(true);
		expect(matchesPattern('temporal.workflow.get', 'temporal.**.get')).toBe(true);
		expect(matchesPattern('temporal.get', 'temporal.**.get')).toBe(false);
	});

	test('tool name shorter than pattern does not match', () => {
		expect(matchesPattern('temporal', 'temporal.workflow.list')).toBe(false);
	});

	test('tool name longer than pattern does not match', () => {
		expect(matchesPattern('temporal.workflow.list.extra', 'temporal.workflow.list')).toBe(false);
	});
});

describe('matchesAnyPattern', () => {
	test('returns true when at least one pattern matches', () => {
		expect(
			matchesAnyPattern('temporal.workflow.list', [
				'temporal.schedule.*',
				'temporal.workflow.*',
			]),
		).toBe(true);
	});

	test('returns false when no patterns match', () => {
		expect(
			matchesAnyPattern('temporal.workflow.list', [
				'temporal.schedule.*',
				'temporal.cluster.*',
			]),
		).toBe(false);
	});

	test('returns false for an empty pattern list', () => {
		expect(matchesAnyPattern('temporal.workflow.list', [])).toBe(false);
	});
});

import { describe, expect, it } from 'vitest';
import { parseCliArguments } from '../src/index.js';
import { UsageError } from '../src/errors.js';

describe('parseCliArguments positionals', () => {
  it('uses a single positional as the query', () => {
    expect(parseCliArguments(['Toulouse']).query).toBe('Toulouse');
  });

  it('joins every positional with a single space', () => {
    expect(parseCliArguments(['8', 'rue', 'du', 'Taur', 'Toulouse']).query).toBe(
      '8 rue du Taur Toulouse',
    );
  });

  it('keeps an already quoted address intact', () => {
    expect(parseCliArguments(['8 rue du Taur, Toulouse']).query).toBe(
      '8 rue du Taur, Toulouse',
    );
  });

  it('joins positionals that appear around a flag', () => {
    const args = parseCliArguments(['8', 'rue', '--no-color', 'du', 'Taur']);

    expect(args.query).toBe('8 rue du Taur');
    expect(args.colorDisabled).toBe(true);
  });
});

describe('parseCliArguments flags', () => {
  it('defaults every flag to false', () => {
    const args = parseCliArguments(['Toulouse']);

    expect(args.help).toBe(false);
    expect(args.version).toBe(false);
    expect(args.colorDisabled).toBe(false);
  });

  it('accepts the long and short help flags without a positional', () => {
    expect(parseCliArguments(['--help']).help).toBe(true);
    expect(parseCliArguments(['-h']).help).toBe(true);
  });

  it('accepts the long and short version flags without a positional', () => {
    expect(parseCliArguments(['--version']).version).toBe(true);
    expect(parseCliArguments(['-v']).version).toBe(true);
  });

  it('accepts the no-color flag', () => {
    expect(parseCliArguments(['--no-color', 'Toulouse']).colorDisabled).toBe(
      true,
    );
  });
});

describe('parseCliArguments failures', () => {
  it('rejects an empty argument list with exit code 2', () => {
    expect(() => parseCliArguments([])).toThrow(UsageError);
    expect(() => parseCliArguments([])).toThrow('missing address argument');
    try {
      parseCliArguments([]);
    } catch (error) {
      expect(error).toMatchObject({ exitCode: 2 });
    }
  });

  it('rejects a blank positional', () => {
    expect(() => parseCliArguments(['   '])).toThrow('missing address argument');
  });

  it('rejects an unknown flag with exit code 2', () => {
    expect(() => parseCliArguments(['--nope', 'Toulouse'])).toThrow(UsageError);
    try {
      parseCliArguments(['--nope', 'Toulouse']);
    } catch (error) {
      expect(error).toMatchObject({ exitCode: 2 });
      expect(String(error)).toContain('--nope');
    }
  });

  it('keeps the usage message on a single line', () => {
    try {
      parseCliArguments(['--nope']);
    } catch (error) {
      expect(error).toBeInstanceOf(UsageError);
      if (error instanceof UsageError) {
        expect(error.message).not.toContain('\n');
      }
    }
  });
});

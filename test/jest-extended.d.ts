import 'jest-extended';

// Augment the expect package's Matchers interface to include jest-extended matchers
declare module 'expect' {
  interface Matchers<R> {
    toBeAfter(date: Date): R;
    toBeAfterOrEqualTo(date: Date): R;
    toBeArray(): R;
    toBeArrayOfBooleans(): R;
    toBeArrayOfNumbers(): R;
    toBeArrayOfObjects(): R;
    toBeArrayOfSize(x: number): R;
    toBeArrayOfStrings(): R;
    toBeBefore(date: Date): R;
    toBeBeforeOrEqualTo(date: Date): R;
    toBeBetween(startDate: Date, endDate: Date): R;
    toBeBigInt(): R;
    toBeBoolean(): R;
    toBeDate(): R;
    toBeEmpty(): R;
    toBeEmptyObject(): R;
    toBeEven(): R;
    toBeExtensible(): R;
    toBeFalse(): R;
    toBeFinite(): R;
    toBeFrozen(): R;
    toBeFunction(): R;
    toBeHexadecimal(): R;
    toBeInteger(): R;
    toBeNaN(): R;
    toBeNegative(): R;
    toBeNil(): R;
    toBeNumber(): R;
    toBeObject(): R;
    toBeOdd(): R;
    toBeOneOf<E = unknown>(members: readonly E[]): R;
    toBePositive(): R;
    toBeSealed(): R;
    toBeString(): R;
    toBeSymbol(): R;
    toBeTrue(): R;
    toBeValidDate(): R;
    toBeWithin(start: number, end: number): R;
    toContainAllEntries<K = unknown, V = unknown>(entries: readonly (readonly [K, V])[]): R;
    toContainAllKeys<E = unknown>(keys: readonly E[]): R;
    toContainAllValues<E = unknown>(values: readonly E[]): R;
    toContainAnyEntries<K = unknown, V = unknown>(entries: readonly (readonly [K, V])[]): R;
    toContainAnyKeys<E = unknown>(keys: readonly E[]): R;
    toContainAnyValues<E = unknown>(values: readonly E[]): R;
    toContainEntries<K = unknown, V = unknown>(entries: readonly (readonly [K, V])[]): R;
    toContainEntry<E = unknown>(entry: readonly [string, E]): R;
    toContainKey(key: string): R;
    toContainKeys<E = unknown>(keys: readonly E[]): R;
    toContainValue<E = unknown>(value: E): R;
    toContainValues<E = unknown>(values: readonly E[]): R;
    toEndWith(suffix: string): R;
    toEqualCaseInsensitive(string: string): R;
    toEqualIgnoringWhitespace(string: string): R;
    toInclude(substring: string): R;
    toIncludeAllMembers<E = unknown>(members: E | readonly E[]): R;
    toIncludeAllPartialMembers<E = unknown>(members: E | readonly E[]): R;
    toIncludeAnyMembers<E = unknown>(members: E | readonly E[]): R;
    toIncludeMultiple(substring: readonly string[]): R;
    toIncludeRepeated(substring: string, times: number): R;
    toIncludeSameMembers<E = unknown>(members: readonly E[]): R;
    toIncludeSamePartialMembers<E = unknown>(members: readonly E[]): R;
    toPartiallyContain<E = unknown>(member: E): R;
    toSatisfy<E = unknown>(predicate: (x: E) => boolean): R;
    toSatisfyAll<E = unknown>(predicate: (x: E) => boolean): R;
    toSatisfyAny<E = unknown>(predicate: (x: E) => boolean): R;
    toStartWith(prefix: string): R;
    toThrowWithMessage(
      type: ((...args: unknown[]) => { message: string }) | (new (...args: unknown[]) => { message: string }),
      message: RegExp | string,
    ): R;
  }
}


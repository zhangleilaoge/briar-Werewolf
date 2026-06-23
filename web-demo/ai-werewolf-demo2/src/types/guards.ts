// ============================================================
// Memory Content Guards — 运行时类型安全
// 替代 `as` 断言，在读取记忆 content 时做运行时验证
// ============================================================

/**
 * 安全读取 content 中的字符串字段。
 * 若字段不存在或类型不符，返回 undefined 而非抛出异常。
 */
export function getString(content: Record<string, unknown>, key: string): string | undefined {
	const val = content[key];
	return typeof val === 'string' ? val : undefined;
}

/** 安全读取 content 中的布尔字段 */
export function getBoolean(content: Record<string, unknown>, key: string): boolean | undefined {
	const val = content[key];
	return typeof val === 'boolean' ? val : undefined;
}

/** 安全读取 content 中的数字字段 */
export function getNumber(content: Record<string, unknown>, key: string): number | undefined {
	const val = content[key];
	return typeof val === 'number' ? val : undefined;
}

/** 安全读取 content 中的对象字段 */
export function getObject<T extends Record<string, unknown>>(
	content: Record<string, unknown>,
	key: string,
): T | undefined {
	const val = content[key];
	return val && typeof val === 'object' && !Array.isArray(val) ? (val as T) : undefined;
}

// 노드 태그: 프로젝트 공용 목록(루트 문서 tags)과 노드별 태그 ID.

export const MAX_PROJECT_TAGS = 200;
export const MAX_NODE_TAGS = 20;
export const MAX_TAG_NAME_LENGTH = 30;

/** 태그 이름 규칙: 1~30자, 공백·'#' 없음. */
export const TAG_NAME_PATTERN = /^[^\s#]{1,30}$/u;

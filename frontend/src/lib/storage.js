const POSTS_KEY = "blockshield:react-posts:v2";

export function readPosts() {
  const raw = localStorage.getItem(POSTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writePosts(posts) {
  try {
    localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
  } catch (error) {
    if (error?.name === "QuotaExceededError" || error?.code === 22) {
      throw new Error(
        "브라우저 저장 공간이 부족합니다. 이미지 크기를 줄이거나 이전 글을 지워 주세요."
      );
    }
    throw new Error("글을 저장하지 못했습니다.");
  }
}

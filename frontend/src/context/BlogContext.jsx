import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { readPosts, writePosts } from "../lib/storage";

const BlogContext = createContext(null);

export function BlogProvider({ children }) {
  const [posts, setPosts] = useState(() => readPosts());

  const upsertPost = useCallback((payload, editingPostId = null) => {
    const now = new Date().toISOString();
    let savedId = editingPostId;
    setPosts((current) => {
      const nextPosts = [...current];
      if (editingPostId) {
        const idx = nextPosts.findIndex((post) => post.id === editingPostId);
        if (idx === -1) throw new Error("수정할 글을 찾을 수 없습니다.");
        nextPosts[idx] = { ...nextPosts[idx], ...payload, updatedAt: now };
        savedId = editingPostId;
      } else {
        const { id: payloadId, ...rest } = payload;
        savedId = payloadId || crypto.randomUUID();
        nextPosts.unshift({
          id: savedId,
          createdAt: now,
          updatedAt: now,
          ...rest,
        });
      }
      writePosts(nextPosts);
      return nextPosts;
    });
    return savedId;
  }, []);

  const value = useMemo(
    () => ({
      posts,
      upsertPost,
    }),
    [posts, upsertPost]
  );

  return <BlogContext.Provider value={value}>{children}</BlogContext.Provider>;
}

export function useBlog() {
  const ctx = useContext(BlogContext);
  if (!ctx) throw new Error("useBlog must be used inside BlogProvider.");
  return ctx;
}

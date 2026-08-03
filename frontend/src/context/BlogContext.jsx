import { createContext, useContext, useMemo, useState } from "react";
import { readPosts, writePosts, readWeb3Settings, writeWeb3Settings } from "../lib/storage";

const BlogContext = createContext(null);

export function BlogProvider({ children }) {
  const [posts, setPosts] = useState(() => readPosts());
  const [web3Settings, setWeb3Settings] = useState(() => readWeb3Settings());

  const upsertPost = (payload, editingPostId = null) => {
    const now = new Date().toISOString();
    const nextPosts = [...posts];
    if (editingPostId) {
      const idx = nextPosts.findIndex((post) => post.id === editingPostId);
      if (idx === -1) throw new Error("Post not found.");
      nextPosts[idx] = { ...nextPosts[idx], ...payload, updatedAt: now };
    } else {
      const { id: payloadId, ...rest } = payload;
      nextPosts.unshift({
        id: payloadId || crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        ...rest,
      });
    }
    setPosts(nextPosts);
    writePosts(nextPosts);
    return editingPostId ? editingPostId : nextPosts[0].id;
  };

  const updateWeb3Settings = (next) => {
    setWeb3Settings(next);
    writeWeb3Settings(next);
  };

  const value = useMemo(
    () => ({
      posts,
      web3Settings,
      upsertPost,
      updateWeb3Settings,
    }),
    [posts, web3Settings]
  );

  return <BlogContext.Provider value={value}>{children}</BlogContext.Provider>;
}

export function useBlog() {
  const ctx = useContext(BlogContext);
  if (!ctx) throw new Error("useBlog must be used inside BlogProvider.");
  return ctx;
}

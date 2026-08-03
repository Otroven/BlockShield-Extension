import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { FeedPage } from "./pages/FeedPage";
import { PostDetailPage } from "./pages/PostDetailPage";
import { EditorPage } from "./pages/EditorPage";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/feed" replace />} />
        <Route path="/feed" element={<FeedPage />} />
        <Route path="/post/:postId" element={<PostDetailPage />} />
        <Route path="/editor" element={<EditorPage mode="create" />} />
        <Route path="/editor/:postId" element={<EditorPage mode="edit" />} />
      </Routes>
    </Layout>
  );
}

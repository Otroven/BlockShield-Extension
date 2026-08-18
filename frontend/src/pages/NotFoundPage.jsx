import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="page container">
      <div className="empty">
        <p>페이지를 찾을 수 없습니다.</p>
        <Link to="/feed" className="btn-primary">
          피드로 돌아가기
        </Link>
      </div>
    </section>
  );
}

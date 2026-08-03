import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useBlog } from "../context/BlogContext";
import { computePerceptualHashFromFile } from "../lib/phash";
import {
  buildPostScope,
  connectWallet,
  getConnectedWallet,
  normalizeScope,
  registerOriginalContent,
  updateContentScopes,
} from "../lib/web3";

function toAuthorId(name) {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("이미지 변환에 실패했습니다."));
    reader.readAsDataURL(file);
  });
}

function formatWalletStatus(wallet) {
  if (!wallet) return "지갑 미연결";
  return `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)} · chain ${
    wallet.chainId
  }`;
}

export function EditorPage({ mode }) {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { posts, upsertPost } = useBlog();

  const contractAddress =
    import.meta.env.VITE_CONTRACT_ADDRESS ||
    "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const chainId = Number(import.meta.env.VITE_CHAIN_ID || 31337);

  const editingPost = useMemo(
    () => posts.find((post) => post.id === postId),
    [posts, postId]
  );
  const isEdit = mode === "edit";

  const [authorName, setAuthorName] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [scopeEntries, setScopeEntries] = useState([""]);
  const [imageUrl, setImageUrl] = useState("");
  const [pHash, setPHash] = useState("");
  const [registerOnchain, setRegisterOnchain] = useState(true);
  const [wallet, setWallet] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getConnectedWallet()
      .then((connected) => {
        if (!cancelled) setWallet(connected);
      })
      .catch(() => {
        if (!cancelled) setWallet(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    if (!editingPost) return;
    setTitle(editingPost.title);
    setContent(editingPost.content);
    setScopeEntries(
      editingPost.allowedScopes?.length ? editingPost.allowedScopes : [""]
    );
    setImageUrl(editingPost.imageUrl || "");
    setPHash(editingPost.pHash || "");
    setAuthorName(editingPost.authorName || "");
    setRegisterOnchain(!editingPost.onchain);
  }, [isEdit, editingPost]);

  if (isEdit && !editingPost) {
    return (
      <section className="page container">
        <p className="empty">수정할 글을 찾을 수 없습니다.</p>
      </section>
    );
  }

  const alreadyOnchain = isEdit && !!editingPost.onchain;
  const walletReady = !!wallet;

  const onConnectWallet = async () => {
    try {
      const connected = await connectWallet();
      setWallet(connected);
    } catch (error) {
      setWallet(null);
      window.alert(error.message || "지갑 연결에 실패했습니다.");
    }
  };

  const onDisconnectWallet = async () => {
    try {
      if (window.ethereum?.request) {
        await window.ethereum.request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }],
        });
      }
    } catch {
      // MetaMask 버전에 따라 revoke가 없을 수 있음 → 앱 상태만 끊음
    }
    setWallet(null);
  };

  const onImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const [dataUrl, hash] = await Promise.all([
        toDataUrl(file),
        computePerceptualHashFromFile(file),
      ]);
      setImageUrl(dataUrl);
      setPHash(hash.bytes32);
    } catch (error) {
      window.alert(error.message || "이미지 처리에 실패했습니다.");
    }
  };

  const updateScopeEntry = (index, value) => {
    setScopeEntries((prev) =>
      prev.map((item, idx) => (idx === index ? value : item))
    );
  };

  const addScopeEntry = () => {
    setScopeEntries((prev) => [...prev, ""]);
  };

  const removeScopeEntry = (index) => {
    setScopeEntries((prev) => {
      if (prev.length === 1) return [""];
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const onSubmit = async (event) => {
    event.preventDefault();

    if (!authorName.trim() || !title.trim() || !content.trim()) {
      window.alert("작성자, 제목, 내용을 입력하세요.");
      return;
    }
    if (!imageUrl) {
      window.alert("이미지를 업로드하세요.");
      return;
    }
    if (!pHash) {
      window.alert("pHash 계산이 필요합니다.");
      return;
    }

    const willRegister = registerOnchain && !alreadyOnchain;
    if (willRegister && !walletReady) {
      window.alert("온체인 등록을 사용하려면 먼저 MetaMask를 연결하세요.");
      return;
    }

    let allowedScopes;
    try {
      if (isEdit) {
        allowedScopes = scopeEntries
          .map((entry) => entry.trim())
          .filter(Boolean)
          .map((entry) => normalizeScope(entry));
        if (!allowedScopes.length) {
          throw new Error("저작권 허용 URL을 최소 1개 입력하세요.");
        }
      } else {
        allowedScopes = null;
      }
    } catch (error) {
      window.alert(error.message);
      return;
    }

    setSaving(true);
    try {
      const authorId = toAuthorId(authorName);
      const postIdForSave = isEdit ? editingPost.id : crypto.randomUUID();
      if (!isEdit) {
        allowedScopes = [buildPostScope(postIdForSave)];
      }

      let chainResult = null;
      let onchain = alreadyOnchain;

      if (willRegister) {
        chainResult = await registerOriginalContent({
          contractAddress,
          expectedChainId: chainId,
          pHashBytes32: pHash,
          allowedScopes,
        });
        onchain = true;
      } else if (alreadyOnchain) {
        const prev = new Set(editingPost.allowedScopes || []);
        const next = new Set(allowedScopes);
        const scopesToAdd = allowedScopes.filter((scope) => !prev.has(scope));
        const scopesToRemove = [...prev].filter((scope) => !next.has(scope));
        if (scopesToAdd.length || scopesToRemove.length) {
          if (!walletReady) {
            window.alert(
              "허용 URL을 온체인에 반영하려면 먼저 MetaMask를 연결하세요."
            );
            return;
          }
          chainResult = await updateContentScopes({
            contractAddress,
            expectedChainId: chainId,
            pHashBytes32: pHash,
            scopesToAdd,
            scopesToRemove,
          });
        }
      }

      const newId = upsertPost(
        {
          id: postIdForSave,
          authorId,
          authorName: authorName.trim(),
          title: title.trim(),
          content: content.trim(),
          allowedScopes,
          imageUrl,
          pHash,
          onchain,
          txHash: chainResult?.txHash || editingPost?.txHash || "",
        },
        isEdit ? editingPost.id : null
      );

      navigate(`/post/${newId}`);
    } catch (error) {
      window.alert(error.message || "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="page container editor">
      <div className="editor-headline">
        <h1>{isEdit ? "포스트 수정" : "새 포스트 작성"}</h1>
        <p className="editor-help">
          {isEdit
            ? "허용 URL을 추가·수정하고, 필요하면 온체인 화이트리스트에 반영하세요."
            : "글과 이미지를 작성하세요. 온체인 등록 시 이 포스트 URL이 기본 허용 스코프로 들어갑니다."}
        </p>
      </div>

      <form className="editor-layout" onSubmit={onSubmit}>
        <div className="editor-main">
          <div className="editor-section">
            <h2>콘텐츠</h2>
            <div className="grid-two">
              <label>
                작성자명
                <input
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  maxLength={40}
                  placeholder="홍길동"
                  required
                />
              </label>
              <label>
                제목
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={100}
                  required
                />
              </label>
            </div>
            <label>
              본문
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={14}
                maxLength={5000}
                required
              />
            </label>
          </div>

          <div className="editor-section">
            <h2>이미지</h2>
            <label className="upload-box">
              <span className="upload-title">대표 이미지 업로드</span>
              <span className="upload-desc">클릭해서 이미지를 선택하세요</span>
              <input type="file" accept="image/*" onChange={onImageChange} />
            </label>
            {imageUrl && (
              <img src={imageUrl} alt="preview" className="editor-preview" />
            )}
          </div>
        </div>

        <aside className="editor-aside">
          {isEdit && (
            <div className="editor-section">
              <div className="scope-list-header">
                <h2>저작권 허용 URL</h2>
                <button
                  type="button"
                  className="btn-chip"
                  onClick={addScopeEntry}
                >
                  + 추가
                </button>
              </div>
              <p className="section-tip">예: blog.naver.com/otroven</p>
              <div className="scope-list">
                {scopeEntries.map((scope, index) => (
                  <div key={`scope-${index}`} className="scope-row">
                    <input
                      value={scope}
                      onChange={(e) => updateScopeEntry(index, e.target.value)}
                      placeholder="blog.naver.com/your-blog-id"
                    />
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => removeScopeEntry(index)}
                      disabled={scopeEntries.length === 1}
                      aria-label="remove scope"
                    >
                      −
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="editor-section">
            <h2>온체인 등록</h2>
            {alreadyOnchain ? (
              <p className="chain-hint">
                이미 온체인에 등록된 포스트입니다. 허용 URL 변경 시 지갑 서명이
                필요합니다.
              </p>
            ) : (
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={registerOnchain}
                  onChange={(e) => setRegisterOnchain(e.target.checked)}
                />
                <span>블록체인에 이미지 저작권 등록</span>
              </label>
            )}

            {(registerOnchain || alreadyOnchain) && (
              <div className="chain-panel">
                {walletReady ? (
                  <>
                    <p className="wallet-line is-connected">
                      {formatWalletStatus(wallet)}
                    </p>
                    <button
                      type="button"
                      className="btn-secondary chain-connect"
                      onClick={onDisconnectWallet}
                    >
                      MetaMask 연결 끊기
                    </button>
                    {!alreadyOnchain && (
                      <p className="chain-hint">
                        저장 시 서명 후 등록 트랜잭션이 실행됩니다.
                      </p>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn-secondary chain-connect"
                    onClick={onConnectWallet}
                  >
                    MetaMask 연결
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="editor-actions">
            <button className="btn-primary" type="submit" disabled={saving}>
              {saving ? "저장 중..." : isEdit ? "수정 저장" : "글 저장"}
            </button>
          </div>
        </aside>
      </form>
    </section>
  );
}

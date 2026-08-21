import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CopyRow } from "../components/CopyRow";
import { useBlog } from "../context/BlogContext";
import { useWallet } from "../context/WalletContext";
import { CHAIN_ID, CONTRACT_ADDRESS, SIMILARITY_THRESHOLD } from "../lib/config";
import { computePerceptualHashFromFile } from "../lib/phash";
import {
  buildPostScope,
  checkSimilarityConflict,
  normalizeScope,
  registerOriginalContent,
  updateContentScopes,
} from "../lib/web3";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

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

export function EditorPage({ mode }) {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { posts, upsertPost } = useBlog();
  const {
    wallet,
    connecting,
    connect,
    disconnect,
    switchNetwork,
    walletReady,
    wrongNetwork,
  } = useWallet();

  const [draftId] = useState(() => crypto.randomUUID());
  const editingPost = useMemo(
    () => posts.find((post) => post.id === postId),
    [posts, postId]
  );
  const isEdit = mode === "edit";
  const postIdForSave = isEdit ? editingPost?.id : draftId;
  const defaultScope = postIdForSave
    ? `${window.location.hostname}/post/${postIdForSave}`
    : "";

  const [authorName, setAuthorName] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [scopeEntries, setScopeEntries] = useState([""]);
  const [imageUrl, setImageUrl] = useState("");
  const [pHash, setPHash] = useState("");
  const [registerOnchain, setRegisterOnchain] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hashing, setHashing] = useState(false);

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

  const onConnectWallet = async () => {
    try {
      await connect();
    } catch (error) {
      window.alert(error.message || "지갑 연결에 실패했습니다.");
    }
  };

  const onSwitchNetwork = async () => {
    try {
      await switchNetwork();
    } catch (error) {
      window.alert(error.message || "네트워크 전환에 실패했습니다.");
    }
  };

  const onImageChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (alreadyOnchain) {
      window.alert("온체인에 등록된 이미지는 바꿀 수 없습니다. 새 글로 등록하세요.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      window.alert("이미지 파일만 업로드할 수 있습니다.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      window.alert("이미지는 2MB 이하만 업로드할 수 있습니다.");
      return;
    }
    setHashing(true);
    try {
      const [dataUrl, hash] = await Promise.all([
        toDataUrl(file),
        computePerceptualHashFromFile(file),
      ]);
      setImageUrl(dataUrl);
      setPHash(hash.bytes32);
    } catch (error) {
      window.alert(error.message || "이미지 처리에 실패했습니다.");
    } finally {
      setHashing(false);
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
      window.alert("pHash 계산이 필요합니다. 이미지를 다시 선택하세요.");
      return;
    }

    const willRegister = registerOnchain && !alreadyOnchain;

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
        allowedScopes = [buildPostScope(postIdForSave)];
      }
    } catch (error) {
      window.alert(error.message);
      return;
    }

    const prevScopes = new Set(editingPost?.allowedScopes || []);
    const scopesToAdd = alreadyOnchain
      ? allowedScopes.filter((scope) => !prevScopes.has(scope))
      : [];
    const scopesToRemove = alreadyOnchain
      ? [...prevScopes].filter((scope) => !allowedScopes.includes(scope))
      : [];
    const willUpdateScopes = scopesToAdd.length > 0 || scopesToRemove.length > 0;
    const needsChain = willRegister || willUpdateScopes;

    if (needsChain && !walletReady) {
      window.alert(
        willRegister
          ? "온체인 등록을 사용하려면 먼저 MetaMask를 연결하세요."
          : "허용 URL을 온체인에 반영하려면 먼저 MetaMask를 연결하세요."
      );
      return;
    }
    if (needsChain && wrongNetwork) {
      window.alert(`지갑 네트워크를 chainId ${CHAIN_ID}로 전환한 뒤 다시 시도하세요.`);
      return;
    }

    setSaving(true);
    try {
      const authorId = toAuthorId(authorName);
      let chainResult = null;
      let onchain = alreadyOnchain;

      if (willRegister) {
        const conflict = await checkSimilarityConflict({
          creatorAddress: wallet?.address,
          fingerprints: [pHash],
          threshold: SIMILARITY_THRESHOLD,
        });
        if (conflict) {
          throw new Error(
            `유사도 게이트에서 차단되었습니다. 선등록자(${conflict.creator})의 이미지와 매우 유사합니다. (해밍 거리 ${conflict.distance})`
          );
        }

        chainResult = await registerOriginalContent({
          contractAddress: CONTRACT_ADDRESS,
          expectedChainId: CHAIN_ID,
          pHashBytes32: pHash,
          allowedScopes,
        });
        onchain = true;
      } else if (willUpdateScopes) {
        chainResult = await updateContentScopes({
          contractAddress: CONTRACT_ADDRESS,
          expectedChainId: CHAIN_ID,
          pHashBytes32: pHash,
          scopesToAdd,
          scopesToRemove,
        });
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
          creator: chainResult?.creator || editingPost?.creator || wallet?.address || "",
          chainId: chainResult?.chainId || editingPost?.chainId || CHAIN_ID,
          blockNumber: chainResult?.blockNumber ?? editingPost?.blockNumber ?? null,
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
        <p className="eyebrow">OriginalContent</p>
        <h1>{isEdit ? "포스트 수정" : "새 포스트 작성"}</h1>
        <p className="editor-help">
          {isEdit
            ? "허용 URL을 추가·수정하고, 필요하면 온체인 화이트리스트에 반영하세요."
            : "이미지의 pHash를 계산한 뒤, 지갑 서명으로 스마트 컨트랙트에 저작권을 기록합니다."}
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
            <h2>이미지 · pHash</h2>
            {alreadyOnchain ? (
              <p className="section-tip">
                이미 온체인에 등록된 pHash는 바꿀 수 없습니다. 다른 이미지는 새 글로
                등록하세요.
              </p>
            ) : (
              <label className={`upload-box ${hashing ? "is-busy" : ""}`}>
                <span className="upload-title">
                  {hashing ? "pHash 계산 중..." : "대표 이미지 업로드"}
                </span>
                <span className="upload-desc">JPG, PNG · 2MB 이하</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={onImageChange}
                  disabled={hashing || saving}
                />
              </label>
            )}
            {imageUrl && (
              <img src={imageUrl} alt="업로드한 대표 이미지 미리보기" className="editor-preview" />
            )}
            {pHash && <CopyRow label="pHash" value={pHash} />}
            {!alreadyOnchain && defaultScope && (
              <p className="chain-hint">기본 허용 URL: {defaultScope}</p>
            )}
          </div>
        </div>

        <aside className="editor-aside">
          {isEdit && (
            <div className="editor-section">
              <div className="scope-list-header">
                <h2>저작권 허용 URL</h2>
                <button type="button" className="btn-chip" onClick={addScopeEntry}>
                  + 추가
                </button>
              </div>
              <p className="section-tip">예: blog.naver.com/your-id</p>
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
                      aria-label="허용 URL 삭제"
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
                {wrongNetwork && (
                  <p className="chain-hint warn">
                    현재 chainId={wallet.chainId}. Anvil({CHAIN_ID})로 전환하세요.
                  </p>
                )}
                {walletReady ? (
                  <>
                    <p className={`wallet-line ${wrongNetwork ? "is-disconnected" : "is-connected"}`}>
                      {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)} · chain{" "}
                      {wallet.chainId}
                    </p>
                    {wrongNetwork ? (
                      <button
                        type="button"
                        className="btn-secondary chain-connect"
                        onClick={onSwitchNetwork}
                      >
                        네트워크 전환
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-secondary chain-connect"
                        onClick={disconnect}
                      >
                        MetaMask 연결 끊기
                      </button>
                    )}
                    {!alreadyOnchain && !wrongNetwork && (
                      <p className="chain-hint">
                        저장 시 EIP-712 서명 후 등록 트랜잭션이 실행됩니다.
                      </p>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn-secondary chain-connect"
                    onClick={onConnectWallet}
                    disabled={connecting}
                  >
                    {connecting ? "연결 중..." : "MetaMask 연결"}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="editor-actions">
            <button className="btn-primary" type="submit" disabled={saving || hashing}>
              {saving ? "저장 중..." : isEdit ? "수정 저장" : "글 저장"}
            </button>
          </div>
        </aside>
      </form>
    </section>
  );
}

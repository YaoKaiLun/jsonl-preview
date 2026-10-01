"""Generate Chrome manifest messages from reviewed locale metadata."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STRINGS = {
    "en": ("Preview JSONL and JSONL.ZSTD locally with searchable records and a JSON tree.", "Open JSONL Viewer"),
    "zh_CN": ("在浏览器本地预览 JSONL 和 JSONL.ZSTD，搜索记录并查看 JSON 树。", "打开 JSONL Viewer"),
    "zh_TW": ("在瀏覽器本機預覽 JSONL 和 JSONL.ZSTD，搜尋記錄並查看 JSON 樹。", "開啟 JSONL Viewer"),
    "ja": ("JSONL と JSONL.ZSTD をブラウザー内でプレビューし、検索と JSON ツリー表示を行います。", "JSONL Viewer を開く"),
    "ko": ("브라우저에서 JSONL 및 JSONL.ZSTD를 미리 보고 검색과 JSON 트리를 사용하세요.", "JSONL Viewer 열기"),
    "es": ("Previsualiza JSONL y JSONL.ZSTD en tu navegador, busca registros y explora el árbol JSON.", "Abrir JSONL Viewer"),
    "fr": ("Prévisualisez JSONL et JSONL.ZSTD dans votre navigateur, recherchez et explorez l’arbre JSON.", "Ouvrir JSONL Viewer"),
    "de": ("JSONL und JSONL.ZSTD im Browser anzeigen, Datensätze suchen und den JSON-Baum erkunden.", "JSONL Viewer öffnen"),
    "pt_BR": ("Visualize JSONL e JSONL.ZSTD no navegador, pesquise registros e explore a árvore JSON.", "Abrir JSONL Viewer"),
}
for locale, (description, action) in STRINGS.items():
    output = ROOT / "_locales" / locale / "messages.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    messages = {
        "extName": {"message": "JSONL Viewer"},
        "extDescription": {"message": description},
        "actionTitle": {"message": action},
    }
    output.write_text(json.dumps(messages, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

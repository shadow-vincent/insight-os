#!/usr/bin/env bash
# V1.2.0 Smoke Test · 完整 API + 关键页面测试
# 用法: bash smoke-test-v1.2.0.sh

BASE="http://127.0.0.1:4191"
PASS=0
FAIL=0
FAILED_TESTS=()

# 颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 测试函数
test_api() {
  local name="$1"
  local method="$2"
  local path="$3"
  local data="$4"
  local expected="$5"

  # LLM 类 endpoint 给 90s 超时，其他 30s
  local timeout=30
  if [[ "$path" == *"/output/multi"* ]] || [[ "$path" == *"/output/scaffold"* ]] || [[ "$path" == *"/output/try-write"* ]] || [[ "$path" == *"/assistant/chat"* ]] || [[ "$path" == *"/output/review"* ]]; then
    timeout=90
  fi

  if [ -n "$data" ]; then
    code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -X "$method" -m "$timeout" \
      -H "Content-Type: application/json" -d "$data" "$BASE$path" 2>&1)
  else
    code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -X "$method" -m "$timeout" \
      "$BASE$path" 2>&1)
  fi

  if [ "$code" = "$expected" ]; then
    echo -e "${GREEN}✓${NC} $name ($code)"
    PASS=$((PASS+1))
  else
    echo -e "${RED}✗${NC} $name ($code, expected $expected)"
    FAIL=$((FAIL+1))
    FAILED_TESTS+=("$name: got $code, expected $expected")
  fi
}

echo "════════════════════════════════════════"
echo "  Insight OS V1.2.0 Smoke Test"
echo "════════════════════════════════════════"
echo ""

# ============ 基础页面 ============
echo "[基础页面]"
test_api "主页" GET "/" "" 200
test_api "inbox 页面" GET "/inbox" "" 200
test_api "candidates 页面" GET "/candidates" "" 200
test_api "assets 页面" GET "/assets" "" 200
test_api "map 页面" GET "/map" "" 200
test_api "graph 页面" GET "/graph" "" 200
test_api "output 页面" GET "/output" "" 200
test_api "settings 页面" GET "/settings" "" 200
test_api "writing 列表" GET "/writing" "" 200
test_api "writing-config-market" GET "/writing-config-market" "" 200
echo ""

# ============ writing-config API ============
echo "[writing-config API]"
test_api "GET /api/writing-config" GET "/api/writing-config" "" 200
test_api "GET /api/writing-config/vincent-standard" GET "/api/writing-config/vincent-standard" "" 200
test_api "GET /api/writing-config/client-comm" GET "/api/writing-config/client-comm" "" 200
test_api "GET /api/writing-config/academic" GET "/api/writing-config/academic" "" 200
test_api "GET /api/writing-config/nonexistent (404)" GET "/api/writing-config/nonexistent" "" 404
test_api "POST /api/writing-config/active" POST "/api/writing-config/active" '{"name":"vincent-standard"}' 200
test_api "GET /api/writing-config/history?name=vincent-standard" GET "/api/writing-config/history?name=vincent-standard" "" 200
test_api "POST /api/writing-config/migrate (old API)" POST "/api/writing-config/migrate" '{"src":"academic","dst":"vincent-standard","fields":{"quality":true}}' 200
test_api "POST /api/writing-config/migrate (new API)" POST "/api/writing-config/migrate" '{"dst":"vincent-standard","sources":{"academic":{"style":true}}}' 200
test_api "POST /api/writing-config/export" POST "/api/writing-config/export" '{"name":"vincent-standard"}' 200
echo ""

# ============ output API ============
echo "[output API]"
test_api "GET /api/output/list" GET "/api/output/list" "" 200
test_api "GET /api/articles?types=article_full" GET "/api/articles?types=article_full" "" 200
test_api "GET /api/articles?types=writing" GET "/api/articles?types=writing" "" 200
echo ""

# ============ scaffold API ============
echo "[scaffold API]"
test_api "POST /api/output/scaffold (wechat_article)" POST "/api/output/scaffold" '{"assetIds":["asset_33658866","asset_80d31b59","asset_54a0d822"],"templateType":"wechat_article"}' 200
test_api "POST /api/output/scaffold (speech)" POST "/api/output/scaffold" '{"assetIds":["asset_33658866","asset_80d31b59"],"templateType":"speech"}' 200
test_api "POST /api/output/scaffold (book_note)" POST "/api/output/scaffold" '{"assetIds":["asset_33658866"],"templateType":"book_note"}' 200
test_api "POST /api/output/scaffold (invalid template)" POST "/api/output/scaffold" '{"assetIds":["asset_33658866"],"templateType":"invalid"}' 400
test_api "POST /api/output/scaffold (empty assets)" POST "/api/output/scaffold" '{"assetIds":[],"templateType":"wechat_article"}' 400
echo ""

# ============ output 多类型 API（并发跑，避免串行排队卡死）============
echo "[output 多类型]"

# 长 LLM 调用 5 个并发跑（dev server 能 handle）
(
  test_api "POST /api/output/multi (article_full)" POST "/api/output/multi" '{"assetIds":["asset_33658866","asset_80d31b59"],"outputType":"article_full","audience":"读者"}' 200
) &
(
  test_api "POST /api/output/multi (speech)" POST "/api/output/multi" '{"assetIds":["asset_33658866","asset_80d31b59"],"outputType":"speech","audience":"CEO"}' 200
) &
(
  test_api "POST /api/output/multi (book_note)" POST "/api/output/multi" '{"assetIds":["asset_33658866","asset_80d31b59"],"outputType":"book_note","audience":"读者"}' 200
) &
(
  test_api "POST /api/output/multi (email)" POST "/api/output/multi" '{"assetIds":["asset_33658866","asset_80d31b59"],"outputType":"email","audience":"客户"}' 200
) &
(
  test_api "POST /api/output/multi (talk_script)" POST "/api/output/multi" '{"assetIds":["asset_33658866","asset_80d31b59"],"outputType":"talk_script","audience":"客户"}' 200
) &
wait
# 短 400 测试串行
test_api "POST /api/output/multi (invalid type)" POST "/api/output/multi" '{"assetIds":["asset_33658866","asset_80d31b59"],"outputType":"invalid","audience":"x"}' 400
test_api "POST /api/output/multi (1 asset only)" POST "/api/output/multi" '{"assetIds":["asset_33658866"],"outputType":"article_full","audience":"x"}' 400
echo ""

# ============ try-write / verify-data / review ============
echo "[质量 + 改稿]"
test_api "POST /api/output/try-write" POST "/api/output/try-write" '{"content":"AI 时代判断力是稀缺能力，比会用 AI 更重要的是知道什么不该让 AI 做。这是 Vincent 反复强调的核心判断。最近在咨询项目中反复验证。","outputType":"article_full","audience":"读者","presetName":"vincent-standard"}' 200
test_api "POST /api/output/verify-data" POST "/api/output/verify-data" '{"content":"最近在做 AI 落地的咨询项目时，发现 80% 的企业 AI 工具 ROI 不到 30%。研究显示，3 万家企业数据表明，技术不是瓶颈。组织吸收力才是真正的拦路虎。德鲁克说过类似的话。"}' 200
test_api "POST /api/output/review" POST "/api/output/review" '{"selectedText":"AI 时代判断力比知识更稀缺。","instruction":"更口语化","presetName":"vincent-standard"}' 200
echo ""

# ============ assistant chat ============
echo "[assistant chat]"
test_api "POST /api/assistant/chat" POST "/api/assistant/chat" '{"message":"找判断力","history":[]}' 200
echo ""

# ============ 总结 ============
echo "════════════════════════════════════════"
TOTAL=$((PASS+FAIL))
echo -e "  通过: ${GREEN}${PASS}${NC}  失败: ${RED}${FAIL}${NC}  总计: ${TOTAL}"
echo "════════════════════════════════════════"

if [ $FAIL -gt 0 ]; then
  echo ""
  echo -e "${RED}失败列表：${NC}"
  for t in "${FAILED_TESTS[@]}"; do
    echo "  - $t"
  done
fi

exit $FAIL
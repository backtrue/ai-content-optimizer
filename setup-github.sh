#!/bin/bash

echo "=========================================="
echo "🚀 AI 內容優化大師 - GitHub 設定"
echo "=========================================="
echo ""

# 顏色定義
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}請輸入您的 GitHub 用戶名：${NC}"
read -p "> " GITHUB_USERNAME

if [ -z "$GITHUB_USERNAME" ]; then
    echo -e "${YELLOW}⚠️  用戶名不能為空${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✓ 用戶名：$GITHUB_USERNAME${NC}"
echo ""

# 設定遠端倉庫
REPO_URL="https://github.com/$GITHUB_USERNAME/ai-content-optimizer.git"

echo -e "${BLUE}正在設定 Git 遠端倉庫...${NC}"
git remote add origin $REPO_URL 2>/dev/null || git remote set-url origin $REPO_URL

echo ""
echo "=========================================="
echo "📝 接下來請完成以下步驟："
echo "=========================================="
echo ""
echo "1️⃣  前往 GitHub 創建新倉庫："
echo "   ${BLUE}https://github.com/new${NC}"
echo ""
echo "2️⃣  倉庫設定："
echo "   - Repository name: ${GREEN}ai-content-optimizer${NC}"
echo "   - Description: AI 內容優化大師"
echo "   - 可見性: Public 或 Private"
echo "   - ${YELLOW}⚠️  不要勾選 'Initialize with README'${NC}"
echo ""
echo "3️⃣  創建倉庫後，按 Enter 繼續推送代碼..."
read -p ""

echo ""
echo -e "${BLUE}正在推送代碼到 GitHub...${NC}"
git push -u origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo -e "${GREEN}✅ 成功推送到 GitHub！${NC}"
    echo "=========================================="
    echo ""
    echo "📍 您的倉庫位置："
    echo "   https://github.com/$GITHUB_USERNAME/ai-content-optimizer"
    echo ""
    echo "=========================================="
    echo "🌐 下一步：部署到 Cloudflare Pages"
    echo "=========================================="
    echo ""
    echo "1. 前往 Cloudflare Dashboard："
    echo "   ${BLUE}https://dash.cloudflare.com/${NC}"
    echo ""
    echo "2. 選擇 ${GREEN}Workers & Pages${NC} → ${GREEN}Create application${NC} → ${GREEN}Pages${NC}"
    echo ""
    echo "3. 連接 GitHub 並選擇 ${GREEN}ai-content-optimizer${NC} 倉庫"
    echo ""
    echo "4. 構建設定："
    echo "   Framework preset: ${YELLOW}None${NC}"
    echo "   Build command: ${GREEN}npm run build${NC}"
    echo "   Build output: ${GREEN}dist${NC}"
    echo ""
    echo "5. 環境變數（選一個）："
    echo "   ${GREEN}OPENAI_API_KEY${NC} 或 ${GREEN}GEMINI_API_KEY${NC}"
    echo ""
    echo "6. 點擊 ${GREEN}Save and Deploy${NC}"
    echo ""
    echo "=========================================="
    echo "🎉 完成後您將獲得一個網址！"
    echo "=========================================="
else
    echo ""
    echo -e "${YELLOW}⚠️  推送失敗。請確認：${NC}"
    echo "   1. GitHub 倉庫已創建"
    echo "   2. 用戶名正確"
    echo "   3. 您有權限推送到該倉庫"
    echo ""
    echo "手動推送命令："
    echo "   ${BLUE}git push -u origin main${NC}"
fi

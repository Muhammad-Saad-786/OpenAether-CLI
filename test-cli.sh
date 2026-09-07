#!/bin/bash

echo "🔍 OpenAether CLI Test Suite"
echo "============================"

# 1. File structure
echo ""
echo "📁 Checking file structure..."
FILES=(
  "src/cli.ts"
  "src/config.ts"
  "src/repl.ts"
  "src/commands.ts"
  "src/provider/openrouter.ts"
  "src/provider/client.ts"
  "src/provider/types.ts"
  "src/conversation/context.ts"
  "src/conversation/session.ts"
  "src/core/query.ts"
  "src/core/engine.ts"
  "src/tools/registry.ts"
  "src/tools/file-read.ts"
  "src/tools/file-write.ts"
  "src/tools/file-edit.ts"
  "src/tools/grep.ts"
  "src/tools/bash.ts"
  "src/utils/logger.ts"
  "src/utils/errors.ts"
  "src/utils/retry.ts"
  "src/utils/history.ts"
  "src/utils/storage.ts"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "✅ $file"
  else
    echo "❌ Missing: $file"
  fi
done

# 2. Check for Anthropic references
echo ""
echo "🔍 Checking for Anthropic/Claude references..."
if grep -ri "anthropic\|claude" src/ 2>/dev/null | grep -v "node_modules"; then
  echo "⚠️ Found references (check if they're just comments)"
else
  echo "✅ Clean"
fi

# 3. TypeScript check
echo ""
echo "🔧 TypeScript compilation..."
npx tsc --noEmit 2>&1 | head -30
if [ ${PIPESTATUS[0]} -eq 0 ]; then
  echo "✅ No TypeScript errors"
else
  echo "❌ TypeScript errors found (see above)"
fi

# 4. Config test
echo ""
echo "⚙️ Testing config..."
bun run test-config.ts 2>&1

# 5. Tools test
echo ""
echo "🛠️ Testing tools..."
bun run test-tools.ts 2>&1

# 6. API test
echo ""
echo "🌐 Testing OpenRouter API..."
if [ -z "$OPENROUTER_API_KEY" ]; then
  echo "⚠️ OPENROUTER_API_KEY not set - skipping API test"
  echo "   Set it with: export OPENROUTER_API_KEY=your_key"
else
  bun run test-api.ts 2>&1
fi

echo ""
echo "✅ Test suite complete"
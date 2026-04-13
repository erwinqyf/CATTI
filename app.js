/**
 * CATTI 二级笔译 - 前端应用（纯前端版）
 */

// 全局状态
let currentQuestion = null;
let practiceTimer = null;
let practiceElapsedTime = 0;

// API 配置 - 支持多个服务商的 OpenAI 兼容 API
const API_PROVIDERS = {
    aliyun: {
        url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        placeholder: 'sk-...'
    },
    deepseek: {
        url: 'https://api.deepseek.com/v1/chat/completions',
        placeholder: 'sk-...'
    },
    zhipu: {
        url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        placeholder: 'sk-...'
    },
    kimi: {
        url: 'https://api.moonshot.cn/v1/chat/completions',
        placeholder: 'sk-...'
    },
    minimax: {
        url: 'https://api.minimaxi.com/v1/chat/completions',
        placeholder: 'xxxxx'
    }
};

// 页面初始化
document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    loadStats();
    loadHistory();

    // 监听译文输入
    document.getElementById('target-text').addEventListener('input', updateWordCount);

    // 启动计时器
    startTimer();
});

// ==================== 配置相关函数 ====================

function loadConfig() {
    const apiKey = localStorage.getItem('apiKey') || '';
    const modelName = localStorage.getItem('modelName') || 'qwen3-coder-next';

    document.getElementById('api-key').value = apiKey;
    document.getElementById('model-name').value = modelName;

    // 更新模态框中的值
    const modalApiKey = document.getElementById('api-key-modal') || document.getElementById('api-key');
    const modalModelName = document.getElementById('model-name-modal') || document.getElementById('model-name');

    if (modalApiKey) modalApiKey.value = apiKey;
    if (modalModelName) modalModelName.value = modelName;
}

function saveConfig() {
    const apiKey = document.getElementById('api-key').value.trim();
    const modelName = document.getElementById('model-name').value;

    if (!apiKey) {
        showStatus('请配置 API Key', 'error');
        return;
    }

    localStorage.setItem('apiKey', apiKey);
    localStorage.setItem('modelName', modelName);

    showStatus('配置已保存', 'success');
    setTimeout(() => {
        closeConfigModal();
        hideStatus();
    }, 1500);
}

function showConfigModal() {
    document.getElementById('config-modal').style.display = 'block';
}

function closeConfigModal() {
    document.getElementById('config-modal').style.display = 'none';
}

function closeDifyConfig() {
    document.getElementById('dify-config-modal').style.display = 'none';
}

function saveDifyConfig() {
    const difyApiKey = document.getElementById('dify-api-key').value.trim();
    const difyWorkflowId = document.getElementById('dify-workflow-id').value.trim();
    const difyBaseUrl = document.getElementById('dify-base-url').value.trim() || 'https://api.dify.ai/v1';

    localStorage.setItem('difyApiKey', difyApiKey);
    localStorage.setItem('difyWorkflowId', difyWorkflowId);
    localStorage.setItem('difyBaseUrl', difyBaseUrl);

    showStatus('Dify 配置已保存', 'success');
    setTimeout(() => {
        closeDifyConfig();
        hideStatus();
    }, 1500);
}

function showStatus(message, type = 'success') {
    const statusEl = document.getElementById('config-status');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.style.color = type === 'error' ? '#ff4444' : '#4CAF50';
    }
}

function hideStatus() {
    const statusEl = document.getElementById('config-status');
    if (statusEl) statusEl.textContent = '';
}

// ==================== 标签页切换 ====================

function showTab(tabName) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.includes(tabName === 'home' ? '首页' : tabName === 'practice' ? '练习' : '批改')) {
            btn.classList.add('active');
        }
    });

    if (tabName === 'home') {
        loadStats();
    } else if (tabName === 'grading') {
        loadHistory();
    }
}

// ==================== 练习模式相关 ====================

function goToPractice() {
    // 检查 API Key
    const apiKey = localStorage.getItem('apiKey');
    if (!apiKey) {
        showStatus('请先配置 API Key', 'error');
        showConfigModal();
        return;
    }
    showTab('practice');
    generateNextQuestion();
}

// 获取提供商配置
function getProviderConfig(modelName) {
    if (modelName.includes('deepseek')) return API_PROVIDERS.deepseek;
    if (modelName.includes('glm')) return API_PROVIDERS.zhipu;
    if (modelName.includes('kimi')) return API_PROVIDERS.kimi;
    if (modelName.includes('minimax')) return API_PROVIDERS.minimax;
    return API_PROVIDERS.aliyun; // 默认阿里云
}

async function callAPI(messages, temperature = 0.7) {
    const apiKey = localStorage.getItem('apiKey');
    const modelName = localStorage.getItem('modelName') || 'qwen3-coder-next';

    // 获取对应的 API 配置
    const provider = getProviderConfig(modelName);
    const apiUrl = provider.url;

    console.log('Calling API...');
    console.log('Provider:', provider === API_PROVIDERS.aliyun ? '阿里云' : provider === API_PROVIDERS.deepseek ? 'DeepSeek' : '其他');
    console.log('Model:', modelName);
    console.log('API URL:', apiUrl);

    if (!apiKey) {
        throw new Error('请先配置 API Key');
    }

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: modelName,
                messages: messages,
                temperature: temperature
            })
        });

        const data = await response.json();
        console.log('Response status:', response.status);
        console.log('Response data:', data);

        if (!response.ok) {
            throw new Error(data.error?.message || 'API 请求失败');
        }

        // 兼容不同 API 格式
        if (data.output && data.output.choices && data.output.choices.length > 0) {
            return data.output.choices[0].message.content;
        }
        if (data.choices && data.choices.length > 0) {
            return data.choices[0].message.content;
        }
        throw new Error('无法解析 API 返回结果');
    } catch (error) {
        console.error('API Error:', error);
        throw new Error('阿里云 API 调用失败: ' + error.message);
    }
}

async function generateQuestion(topic) {
    // 先切换到练习模式
    showTab('practice');

    const generatingIndicator = document.getElementById('generating-indicator');
    const sourceTextEl = document.getElementById('source-text');

    // 检查 API Key
    const apiKey = localStorage.getItem('apiKey');
    if (!apiKey) {
        sourceTextEl.innerHTML = `<p class="error-message">错误: 请先配置阿里云 API Key</p><p class="hint">点击左上角配置按钮填写 API Key</p>`;
        showConfigModal();
        return;
    }

    generatingIndicator.style.display = 'flex';

    try {
        const prompt = `你是一名专业的 CATTI 二级笔译考试命题专家。请为 "${topic}" 类主题生成一道中译英翻译题。

要求：
1. 题目难度适中，符合 CATTI 二级考试水平
2. 原文长度约 50-80 字
3. 包含典型翻译考点（如专业术语、句型结构等）
4. 提供一份详细的参考译文

请以 JSON 格式返回：
{
    "topic": "主题名称",
    "source_text": "中文原文",
    "reference_translation": "英文参考译文",
    "difficulty": "难度等级",
    "keywords": ["关键词1", "关键词2"]
}`;

        const messages = [
            { role: 'system', content: '你是一个专业的翻译考试命题专家。请严格按照要求返回 JSON 格式。' },
            { role: 'user', content: prompt }
        ];

        const response = await callAPI(messages, 0.7);

        // 解析 JSON 响应
        let question;
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            question = JSON.parse(jsonMatch[0]);
        } else {
            throw new Error('无法解析 AI 返回的题目格式');
        }

        currentQuestion = {
            topic: question.topic || '通用',
            source_text: question.source_text || response,
            reference_translation: question.reference_translation || '参考译文待生成',
            difficulty: question.difficulty || '中等',
            keywords: question.keywords || ['通用']
        };

        // 显示题目
        sourceTextEl.innerHTML = `<p>${escapeHtml(currentQuestion.source_text)}</p>`;
        document.getElementById('practice-topic').textContent = currentQuestion.topic;
        document.getElementById('source-lang').textContent = '中文';
        document.getElementById('grading-content').innerHTML = '<div class="placeholder-text">请输入译文后点击"提交批改"</div>';
        document.getElementById('grade-score').textContent = '--';

    } catch (error) {
        console.error('API 调用错误详情:', error);
        const errorMsg = error.message.includes('Incorrect API key')
            ? '错误: API Key 不正确或权限不足<br><p class="hint">请检查：<br>1. API Key 是否以 sk- 开头<br>2. API Key 是否有 DashScope 使用权限<br>3. API Key 是否已过期</p>'
            : `错误: ${escapeHtml(error.message)}`;
        sourceTextEl.innerHTML = `<p class="error-message">${errorMsg}</p>`;
    } finally {
        generatingIndicator.style.display = 'none';
    }
}

async function generateNextQuestion() {
    const topic = document.getElementById('practice-topic').textContent || '经济类';
    await generateQuestion(topic);
}

// ==================== 译文输入相关 ====================

function clearTranslation() {
    document.getElementById('target-text').value = '';
    updateWordCount();
    document.getElementById('grading-content').innerHTML = '<div class="placeholder-text">请输入译文后点击"提交批改"</div>';
    document.getElementById('grade-score').textContent = '--';
}

function copySource() {
    if (currentQuestion && currentQuestion.source_text) {
        navigator.clipboard.writeText(currentQuestion.source_text)
            .then(() => showStatus('原文已复制', 'success'))
            .catch(() => showStatus('复制失败', 'error'));
    }
}

function updateWordCount() {
    const text = document.getElementById('target-text').value;
    const count = text.replace(/\s/g, '').length;
    document.getElementById('word-count').textContent = `${count} 字`;
}

// ==================== 计时器 ====================

function startTimer() {
    if (practiceTimer) clearInterval(practiceTimer);
    practiceTimer = setInterval(() => {
        practiceElapsedTime++;
        const minutes = Math.floor(practiceElapsedTime / 60);
        const seconds = practiceElapsedTime % 60;
        document.getElementById('timer').textContent =
            `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }, 1000);
}

function resetTimer() {
    if (practiceTimer) clearInterval(practiceTimer);
    practiceElapsedTime = 0;
    document.getElementById('timer').textContent = '00:00';
}

// ==================== 提交批改 ====================

async function submitForGrading() {
    const userText = document.getElementById('target-text').value.trim();

    if (!userText) {
        showStatus('请先输入译文', 'error');
        return;
    }

    if (!currentQuestion) {
        showStatus('请先生成题目', 'error');
        return;
    }

    const totalQuestions = 1;
    const currentQuestionIndex = 1;
    document.getElementById('practice-progress').style.width = '100%';
    document.getElementById('practice-text').textContent = `${currentQuestionIndex}/${totalQuestions}`;

    const generatingIndicator = document.getElementById('generating-indicator');
    generatingIndicator.style.display = 'flex';

    try {
        const prompt = `你是一名专业的 CATTI 二级笔译阅卷专家。请对以下翻译进行批改评分。

【原文】
${currentQuestion.source_text}

【参考译文】
${currentQuestion.reference_translation}

【考生译文】
${userText}

请从以下维度进行评价：
1. 准确性（Accuracy）：是否准确传达原意
2. 完整性（Completeness）：是否遗漏要点
3. 流畅度（Fluency）：英文是否自然流畅
4. 语法（Grammar）：是否有语法错误
5. 词汇（Vocabulary）：用词是否恰当

请以 JSON 格式返回：
{
    "score": 0-100分,
    "comments": "总体评价",
    "accuracy_score": 0-25,
    "completeness_score": 0-25,
    "fluency_score": 0-25,
    "grammar_score": 0-25,
    "vocabulary_score": 0-25,
    "grammar_mistakes": ["错误1", "错误2"],
    "suggestions": ["改进建议1", "改进建议2"]
}`;

        const messages = [
            { role: 'system', content: '你是一个专业的翻译考试阅卷专家，熟悉 CATTI 二级评分标准。请严格按照要求返回 JSON 格式。' },
            { role: 'user', content: prompt }
        ];

        const response = await callAliyunAPI(messages, 0.5);

        // 解析 JSON 响应
        let grading;
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            grading = JSON.parse(jsonMatch[0]);
        } else {
            throw new Error('无法解析 AI 返回的批改格式');
        }

        // 标准化评分
        const normalizedGrading = {
            score: Math.min(100, Math.max(0, grading.score || 70)),
            comments: grading.comments || response,
            accuracy_score: Math.min(25, Math.max(0, grading.accuracy_score || 17)),
            completeness_score: Math.min(25, Math.max(0, grading.completeness_score || 17)),
            fluency_score: Math.min(25, Math.max(0, grading.fluency_score || 17)),
            grammar_score: Math.min(25, Math.max(0, grading.grammar_score || 17)),
            vocabulary_score: Math.min(25, Math.max(0, grading.vocabulary_score || 16)),
            grammar_mistakes: grading.grammar_mistakes || [],
            suggestions: grading.suggestions || []
        };

        displayGradingResult(normalizedGrading);
        showStatus('批改完成', 'success');

    } catch (error) {
        document.getElementById('grading-content').innerHTML =
            `<div class="error-message">错误: ${escapeHtml(error.message)}</div>
             <div class="hint">请检查 API Key 配置是否正确</div>`;
    } finally {
        generatingIndicator.style.display = 'none';
    }
}

function displayGradingResult(grading) {
    const html = `
        <div class="grading-header">
            <div class="score-circle">
                <span class="score-value">${grading.score}</span>
                <span class="score-label">分</span>
            </div>
        </div>
        <div class="grading-details">
            <div class="score-grid">
                <div class="score-item">
                    <span class="score-item-label">准确度</span>
                    <div class="score-bar">
                        <div class="score-bar-fill" style="width: ${grading.accuracy_score * 4}%"></div>
                        <span class="score-bar-value">${grading.accuracy_score}/25</span>
                    </div>
                </div>
                <div class="score-item">
                    <span class="score-item-label">完整性</span>
                    <div class="score-bar">
                        <div class="score-bar-fill" style="width: ${grading.completeness_score * 4}%"></div>
                        <span class="score-bar-value">${grading.completeness_score}/25</span>
                    </div>
                </div>
                <div class="score-item">
                    <span class="score-item-label">流畅度</span>
                    <div class="score-bar">
                        <div class="score-bar-fill" style="width: ${grading.fluency_score * 4}%"></div>
                        <span class="score-bar-value">${grading.fluency_score}/25</span>
                    </div>
                </div>
                <div class="score-item">
                    <span class="score-item-label">语法</span>
                    <div class="score-bar">
                        <div class="score-bar-fill" style="width: ${grading.grammar_score * 4}%"></div>
                        <span class="score-bar-value">${grading.grammar_score}/25</span>
                    </div>
                </div>
                <div class="score-item">
                    <span class="score-item-label">词汇</span>
                    <div class="score-bar">
                        <div class="score-bar-fill" style="width: ${grading.vocabulary_score * 4}%"></div>
                        <span class="score-bar-value">${grading.vocabulary_score}/25</span>
                    </div>
                </div>
            </div>
        </div>
        <div class="grading-feedback">
            <h4>总体评价</h4>
            <p class="comments-text">${escapeHtml(grading.comments)}</p>
        </div>
        ${grading.grammar_mistakes && grading.grammar_mistakes.length > 0 ? `
        <div class="grading-feedback">
            <h4>语法错误</h4>
            <ul class="mistakes-list">
                ${grading.grammar_mistakes.map(m => `<li>${escapeHtml(m)}</li>`).join('')}
            </ul>
        </div>
        ` : ''}
        ${grading.suggestions && grading.suggestions.length > 0 ? `
        <div class="grading-feedback">
            <h4>改进建议</h4>
            <ul class="suggestions-list">
                ${grading.suggestions.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
            </ul>
        </div>
        ` : ''}
    `;

    document.getElementById('grading-content').innerHTML = html;
    document.getElementById('grade-score').textContent = grading.score;
}

// ==================== 统计数据 ====================

function loadStats() {
    try {
        // 本地存储统计
        const history = JSON.parse(localStorage.getItem('gradingHistory') || '[]');
        const total = history.length;
        const avgScore = history.length > 0
            ? Math.round(history.reduce((sum, h) => sum + h.score, 0) / history.length)
            : 0;

        const totalEl = document.getElementById('total-practices');
        const avgEl = document.getElementById('avg-score');
        const timeEl = document.getElementById('study-time');

        if (totalEl) totalEl.textContent = total;
        if (avgEl) avgEl.textContent = avgScore;

        // 计算学习时间（每次练习按平均 10 分钟计算）
        const studyHours = Math.floor(total * 10 / 60);
        if (timeEl) timeEl.textContent = studyHours + 'h';
    } catch (e) {
        console.error('加载统计数据失败:', e);
    }
}

// ==================== 批改历史 ====================

function loadHistory() {
    try {
        const historyContainer = document.getElementById('grading-history');
        if (!historyContainer) return;

        const history = JSON.parse(localStorage.getItem('gradingHistory') || '[]');

        if (history.length === 0) {
            historyContainer.innerHTML = '<div class="empty-history">暂无批改记录</div>';
            return;
        }

        historyContainer.innerHTML = history.map(record => `
            <div class="history-item">
                <div class="history-header">
                    <span class="history-topic">${escapeHtml(record.topic)}</span>
                    <span class="history-score ${getScoreClass(record.score)}">${record.score}分</span>
                </div>
                <div class="history-meta">
                    <span class="history-time">${formatTime(record.timestamp)}</span>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error('加载历史记录失败:', e);
    }
}

function clearHistory() {
    if (!confirm('确定要清空所有批改历史吗？')) return;
    localStorage.removeItem('gradingHistory');
    document.getElementById('grading-history').innerHTML = '<div class="empty-history">暂无批改记录</div>';
    loadStats();
}

// 添加记录到本地历史
function saveToHistory(topic, score) {
    const history = JSON.parse(localStorage.getItem('gradingHistory') || '[]');
    history.unshift({
        topic: topic,
        score: score,
        timestamp: new Date().toISOString()
    });
    // 保存最近 50 条
    localStorage.setItem('gradingHistory', JSON.stringify(history.slice(0, 50)));
}

// ==================== 工具函数 ====================

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getScoreClass(score) {
    if (score >= 85) return 'score-high';
    if (score >= 70) return 'score-medium';
    return 'score-low';
}

function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

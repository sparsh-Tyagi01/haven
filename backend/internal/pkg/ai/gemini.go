package ai

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

type GeminiClient struct {
	APIKey string
}

func NewClient() *GeminiClient {
	return &GeminiClient{
		APIKey: os.Getenv("GEMINI_API_KEY"),
	}
}


type GeminiRequest struct {
	Contents []Content `json:"contents"`
}

type Content struct {
	Parts []Part `json:"parts"`
}

type Part struct {
	Text string `json:"text"`
}

type GeminiResponse struct {
	Candidates []Candidate `json:"candidates"`
}

type Candidate struct {
	Content Content `json:"content"`
}


func (c *GeminiClient) SummarizeThread(title, content string, comments []string) (string, error) {
	prompt := fmt.Sprintf(
		"Synthesize the following community discussion into a structured summary with bullet points.\n\n"+
			"POST TITLE: %s\n"+
			"POST BODY: %s\n\n"+
			"COMMENTS:\n%s\n\n"+
			"Provide a concise summary highlighting: 1. Core Topics, 2. Major Decisions/consensus, 3. Open Issues.",
		title, content, strings.Join(comments, "\n- "),
	)

	if c.APIKey == "" {
		return c.generateMockSummary(title, content, comments), nil
	}

	return c.callGemini(prompt)
}


func (c *GeminiClient) DraftWikiPage(title, content string, comments []string) (string, error) {
	prompt := fmt.Sprintf(
		"Write a structured, educational Wiki article in Markdown format based on this community discussion.\n\n"+
			"TITLE: %s\n"+
			"DISCUSSION CONTENT: %s\n\n"+
			"COMMENTS:\n%s\n\n"+
			"Structure the article with: # Title, ## Overview, ## Core Insights, and ## FAQ.",
		title, content, strings.Join(comments, "\n- "),
	)

	if c.APIKey == "" {
		return c.generateMockWiki(title, content, comments), nil
	}

	return c.callGemini(prompt)
}


func (c *GeminiClient) AnswerWithContext(question string, contextDocs []string) (string, error) {
	if len(contextDocs) == 0 {
		if c.APIKey == "" {
			return "### 🤖 AI Assistant (Offline Mock)\n\nI couldn't find any documents or posts in this community related to your query. As an offline assistant, I cannot access the internet, but you can configure `GEMINI_API_KEY` for live global answers.", nil
		}
		prompt := fmt.Sprintf("Answer the following user query. Note that no specific community documentation was found.\n\nQuery: %s", question)
		return c.callGemini(prompt)
	}

	contextStr := strings.Join(contextDocs, "\n\n")
	prompt := fmt.Sprintf(
		"You are the Haven AI Community Assistant. Answer the user's question using the provided community knowledge base documents.\n\n"+
		"KNOWLEDGE BASE CONTEXT:\n%s\n\n"+
		"USER QUESTION:\n%s\n\n"+
		"Answer clearly, accurately and concisely in Markdown. If the context does not contain the answer, mention that it's not documented but provide a helpful response if possible.",
		contextStr, question,
	)

	if c.APIKey == "" {
		var matchedTitles []string
		for _, doc := range contextDocs {
			lines := strings.Split(doc, "\n")
			if len(lines) > 0 {
				matchedTitles = append(matchedTitles, strings.TrimPrefix(lines[0], "Document: "))
			}
		}
		return fmt.Sprintf(
			"### 🤖 Haven Community Assistant (Offline Mock)\n\n"+
			"I found **%d** matching resource(s) in this community's discussions and wiki pages:\n- %s\n\n"+
			"**Synthesized Answer**:\n"+
			"Based on these files, members frequently discuss these concepts. For detailed steps, you can check these posts directly in the community feed or wiki index.\n\n"+
			"*Configure `GEMINI_API_KEY` in the environment to enable live generative AI responses.*",
			len(contextDocs), strings.Join(matchedTitles, "\n- "),
		), nil
	}

	return c.callGemini(prompt)
}


func (c *GeminiClient) ScanToxicity(text string) (bool, string) {
	normalized := strings.ToLower(text)
	toxicKeywords := []string{"stupid", "idiot", "hate you", "kill yourself", "scam", "spam link"}

	for _, kw := range toxicKeywords {
		if strings.Contains(normalized, kw) {
			return true, fmt.Sprintf("contains flagged phrase: '%s'", kw)
		}
	}

	return false, ""
}


func (c *GeminiClient) callGemini(prompt string) (string, error) {
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=%s", c.APIKey)

	reqBody := GeminiRequest{
		Contents: []Content{
			{
				Parts: []Part{
					{Text: prompt},
				},
			},
		},
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	httpClient := &http.Client{Timeout: 15 * time.Second}
	resp, err := httpClient.Post(url, "application/json", bytes.NewBuffer(jsonBytes))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("gemini api returned status %d: %s", resp.StatusCode, string(respBytes))
	}

	var res GeminiResponse
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return "", err
	}

	if len(res.Candidates) > 0 && len(res.Candidates[0].Content.Parts) > 0 {
		return res.Candidates[0].Content.Parts[0].Text, nil
	}

	return "", fmt.Errorf("no candidates returned from gemini")
}


func (c *GeminiClient) generateMockSummary(title, content string, comments []string) string {
	return fmt.Sprintf(
		"### 🤖 AI Discussion Synthesis\n\n"+
			"**Core Topic**: Analysis of *\"%s\"*.\n\n"+
			"#### 1. Core Summary\n"+
			"- The post coordinates work and discussion regarding: *\"%s\"*.\n"+
			"- Active discussions contain **%d** responses from community participants.\n\n"+
			"#### 2. Key Takeaways & Consensus\n"+
			"- Thread members strongly support structured, verified knowledge base extraction.\n"+
			"- Encourages collaborative peer-review of all answers before marking them solved.\n\n"+
			"#### 3. Resolved Items\n"+
			"- Automated moderation scanner successfully filters spam/harassment keywords.\n\n"+
			"*Generated in Offline Mock Fallback mode. Configure GEMINI_API_KEY in the environment for live AI models.*",
		title, c.truncate(content, 60), len(comments),
	)
}

func (c *GeminiClient) generateMockWiki(title, content string, comments []string) string {
	return fmt.Sprintf(
		"# Guide: %s\n\n"+
			"## Overview\n"+
			"This collaborative documentation has been synthesized from a community discussion regarding *\"%s\"*.\n\n"+
			"## Core Insights\n"+
			"- **Community Dialogue**: The thread details structural improvements and answers community questions.\n"+
			"- **Best Practices**: Ensure all code revisions compile locally before commiting.\n\n"+
			"## FAQ\n"+
			"#### What was the main consensus?\n"+
			"The community agreed to utilize automated Kanban boards to organize future updates.\n\n"+
			"--- \n"+
			"*Synthesized by Haven AI Assistant on %s.*",
		title, c.truncate(content, 120), time.Now().Format("2006-01-02"),
	)
}

func (c *GeminiClient) truncate(s string, limit int) string {
	if len(s) <= limit {
		return s
	}
	return s[:limit] + "..."
}

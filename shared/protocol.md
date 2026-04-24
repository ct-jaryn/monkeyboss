# MonkeyBoss Protocol

## Model Config

```json
{
  "provider": "openai",
  "baseUrl": "https://api.openai.com/v1",
  "model": "gpt-4o-mini",
  "apiKey": "<YOUR_API_KEY>"
}
```

## Task

```json
{
  "id": "task_xxx",
  "target": "zhihu",
  "action": "open_url",
  "payload": {
    "url": "https://www.zhihu.com/"
  },
  "status": "pending"
}
```

## Extension Result

```json
{
  "status": "completed",
  "message": "Opened target url",
  "data": {
    "url": "https://www.zhihu.com/"
  }
}
```

import random
import string
from pathlib import Path
from flask import Flask, jsonify, render_template, request

app = Flask(__name__, template_folder="templates", static_folder="static")

# --- nguồn từ vựng cơ bản (gọn nhẹ). Bạn có thể thay bằng file từ .txt nếu muốn.
BASIC_WORDS = """
time year people way day man thing woman life child world school state family
student group country problem hand part place case week company system program
question work government number night point home water room mother area money
story fact month lot right study book eye job word business issue side kind head
house service friend father power hour game line end member law car city
community name president team minute idea kid body information back parent face
others level office door health person art war history party result change
morning reason research girl guy moment air teacher force education foot boy age
policy everything process music market sense service area activity road behavior
""".split()

def random_words(n=50):
    return " ".join(random.choice(BASIC_WORDS) for _ in range(n))

def random_chars(n=200, charset="letters"):
    if charset == "letters":
        pool = string.ascii_lowercase + "     "
    elif charset == "alnum":
        pool = string.ascii_lowercase + string.digits + "     "
    elif charset == "punct":
        pool = string.ascii_lowercase + string.punctuation + "     "
    else:
        pool = string.ascii_lowercase + "     "
    return "".join(random.choice(pool) for _ in range(n)).replace("\n", " ")

@app.get("/")
def index():
    return render_template("index.html")

@app.get("/api/snippet")
def api_snippet():
    """
    Trả về đoạn text/char ngẫu nhiên cho client.
    query:
      mode = words | chars
      count = số lượng (words: số từ, chars: số ký tự)
      charset = letters | alnum | punct (chỉ dùng cho mode=chars)
    """
    mode = request.args.get("mode", "words")
    count = int(request.args.get("count", 50))
    charset = request.args.get("charset", "letters")

    if mode == "chars":
        text = random_chars(count, charset)
    else:
        text = random_words(count)

    return jsonify({"text": text})

if __name__ == "__main__":
    # Chạy dev trên localhost khác (127.0.0.1:8000) để tránh xung đột
    app.run(debug=True, host="127.0.0.1", port=8000)

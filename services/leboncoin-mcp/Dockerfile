FROM python:3.12-slim
WORKDIR /service
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY adapter.py server.py ./
RUN useradd --system --uid 10001 service
USER service
ENV HOST=0.0.0.0 PORT=8001
EXPOSE 8001
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8001/health',timeout=2)"
CMD ["python", "server.py"]

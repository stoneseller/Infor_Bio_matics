const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {cors: {origin: "*"}});

const PORT = process.env.PORT || 3000;
const CSV_FILE = path.join(__dirname, 'survey_results.csv');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// 실시간 데이터 push
function broadcastSurveyUpdate() {
    if (!fs.existsSync(CSV_FILE)) return;
    const raw = fs.readFileSync(CSV_FILE, 'utf8').split('\n').filter(Boolean);
    if (raw.length < 2) return;
    const header = raw[0].split(',');
    const data = raw.slice(1).map(line => {
        const row = line.split(',');
        let obj = {};
        header.forEach((key, i) => obj[key] = row[i]);
        return obj;
    });
    io.emit('surveyUpdate', data);
}

// 설문 저장 (POST)
app.post('/api/survey', (req, res) => {
    const data = req.body;
    const row = [
        data.name,
        data.grade,
        data.class,
        data.interests.aiDiagnosis,
        data.interests.bioinformatics,
        data.interests.drugDevelopment,
        data.interests.sportsScience,
        data.interests.neuroscience,
        data.interests.epidemiology,
        data.interests.wearableHealth,
        data.interests.agribiotech,
        data.timestamp
    ].join(',') + '\n';

    const isNew = !fs.existsSync(CSV_FILE);
    if (isNew) {
        const header = [
            '이름','학년','반',
            'AI 의료진단','바이오인포매틱스','AI 신약개발','스포츠과학',
            '뇌과학','감염병 예측','웨어러블 헬스케어','농업생명공학',
            '제출시각'
        ].join(',') + '\n';
        fs.appendFileSync(CSV_FILE, header);
    }
    fs.appendFileSync(CSV_FILE, row);
    broadcastSurveyUpdate();
    res.json({success:true});
});

// 최초 조회용 (GET)
app.get('/api/survey', (req, res) => {
    if (!fs.existsSync(CSV_FILE)) return res.json([]);
    const raw = fs.readFileSync(CSV_FILE, 'utf8').split('\n').filter(Boolean);
    if (raw.length < 2) return res.json([]);
    const header = raw[0].split(',');
    const data = raw.slice(1).map(line => {
        const row = line.split(',');
        let obj = {};
        header.forEach((key, i) => obj[key] = row[i]);
        return obj;
    });
    res.json(data);
});

// 소켓 연결
io.on('connection', (socket) => {
    // 최초 연결시 데이터 전송
    if (fs.existsSync(CSV_FILE)) {
        const raw = fs.readFileSync(CSV_FILE, 'utf8').split('\n').filter(Boolean);
        if (raw.length > 1) {
            const header = raw[0].split(',');
            const data = raw.slice(1).map(line => {
                const row = line.split(',');
                let obj = {};
                header.forEach((key, i) => obj[key] = row[i]);
                return obj;
            });
            socket.emit('surveyUpdate', data);
        }
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => {
    console.log(`Socket.io 서버 실행 중: http://localhost:${PORT}`);
});
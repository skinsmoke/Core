import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert as RNAlert,
  Platform,
  TextInput,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Button,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import {
  initDatabase,
  registerUser,
  loginUser,
  addDiaryEntry,
  getDiaryEntries,
  getPosts,
  addPost,
  addComment,
  addCycle,
  getCycles,
  getUserById,
  updateDiaryEntry,
  deleteDiaryEntry,
  deleteCycle,
  deletePost,
  deleteComment,
} from './database';
import { saveSession, loadSession, clearSession } from './session';

// Alert.alert não funciona na web, então usamos window.alert/confirm lá.
const Alert = {
  alert: (title, message, buttons) => {
    if (Platform.OS !== 'web') return RNAlert.alert(title, message, buttons);
    const text = message ? `${title}\n\n${message}` : title;
    if (buttons && buttons.length > 1) {
      const ok = window.confirm(text);
      const target = ok
        ? buttons.find((b) => b.style !== 'cancel')
        : buttons.find((b) => b.style === 'cancel');
      if (target && target.onPress) target.onPress();
    } else {
      window.alert(text);
      if (buttons && buttons[0] && buttons[0].onPress) buttons[0].onPress();
    }
  },
};

const confirmDelete = (title, message, onConfirm) =>
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Apagar', style: 'destructive', onPress: onConfirm },
  ]);

const COLORS = {
  primary: '#FF69B4',
  secondary: '#FFB6C1',
  background: '#FFF0F5',
  text: '#333333',
  placeholder: '#999999',
  link: '#C71585',
  success: '#ef7dd6ff',
  warning: '#fb7adfff',
  danger: '#DC143C',
  RUBY_RED: '#900C3F',
  DEEP_PINK: '#C71585',
  ACCENT: '#FFD700',
  LINK_TEXT: '#4B0082',
};

// ======================================================
// RODAPÉ DE NAVEGAÇÃO
// ======================================================
const NAV_ITEMS = [
  { key: 'Diary', label: 'Diário', icon: 'book', a11y: 'Diário de Desabafos' },
  { key: 'calendar', label: 'Ciclo', icon: 'calendar', a11y: 'Calendário do ciclo' },
  { key: 'Meditation', label: 'Música', icon: 'music', a11y: 'Musicoterapia' },
  { key: 'Forum', label: 'Fórum', icon: 'comments', a11y: 'Fórum da Comunidade' },
];

const NavigationFooter = ({ current, onNavigate }) => {
  return (
    <View style={footerStyles.footerContainer}>
      {NAV_ITEMS.map((item) => {
        const active = current === item.key;
        return (
          <TouchableOpacity
            key={item.key}
            style={footerStyles.navButton}
            onPress={() => onNavigate(item.key)}
            accessibilityLabel={item.a11y}
            accessibilityState={{ selected: active }}>
            <View style={[footerStyles.indicator, active && footerStyles.indicatorActive]} />
            <Icon
              name={item.icon}
              size={22}
              color={active ? COLORS.link : COLORS.placeholder}
            />
            <Text style={[footerStyles.navLabel, active && footerStyles.navLabelActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const footerStyles = StyleSheet.create({
  footerContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    height: 66,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: COLORS.secondary,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    position: 'absolute',
    top: 0,
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  indicatorActive: {
    backgroundColor: COLORS.primary,
  },
  navLabel: {
    fontSize: 11,
    marginTop: 4,
    color: COLORS.placeholder,
    fontWeight: '500',
  },
  navLabelActive: {
    color: COLORS.link,
    fontWeight: '700',
  },
});

const handleLinkPress = async (url) => {
  const supported = await Linking.canOpenURL(url);

  if (supported) {
    await Linking.openURL(url);
  } else {
    Alert.alert('Erro ao abrir link', `Não foi possível abrir: ${url}`);
  }
};

// ======================================================
// MEDITAÇÃO
// ======================================================
const callCVV = async () => {
  try {
    await Linking.openURL('tel:188');
  } catch (e) {
    Alert.alert('Não foi possível ligar', 'Disque 188 pelo seu telefone ou acesse cvv.org.br.');
  }
};

const CvvCard = () => (
  <View style={cvvStyles.card}>
    <View style={cvvStyles.row}>
      <Icon name="phone" size={22} color={COLORS.RUBY_RED} />
      <Text style={cvvStyles.title}>Precisa conversar agora?</Text>
    </View>
    <Text style={cvvStyles.text}>
      O CVV oferece apoio emocional gratuito, 24 horas por dia. Se houver risco imediato,
      ligue 192 (SAMU).
    </Text>
    <View style={cvvStyles.buttons}>
      <TouchableOpacity
        style={cvvStyles.callButton}
        onPress={callCVV}
        accessibilityLabel="Ligar para o CVV, número 188">
        <Text style={cvvStyles.callText}>Ligar 188</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={cvvStyles.siteButton}
        onPress={() => handleLinkPress('https://www.cvv.org.br')}
        accessibilityLabel="Abrir o site do CVV">
        <Text style={cvvStyles.siteText}>Chat e site</Text>
      </TouchableOpacity>
    </View>
  </View>
);

const cvvStyles = StyleSheet.create({
  card: {
    width: '100%',
    padding: 15,
    marginBottom: 25,
    backgroundColor: 'white',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.secondary,
    borderLeftWidth: 5,
    borderLeftColor: COLORS.RUBY_RED,
  },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 17, fontWeight: '700', color: COLORS.RUBY_RED, marginLeft: 10 },
  text: { fontSize: 14, color: COLORS.text, marginBottom: 12, lineHeight: 20 },
  buttons: { flexDirection: 'row' },
  callButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: COLORS.RUBY_RED,
    marginRight: 8,
  },
  callText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
  siteButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.secondary,
  },
  siteText: { color: COLORS.link, fontWeight: 'bold', fontSize: 15 },
});

const TRACKS = [
  {
    title: 'Para Acalmar a Mente',
    subtitle: 'Relaxe e desacelere os pensamentos',
    icon: 'leaf',
    url: 'https://youtu.be/rVTqBPop4LA?si=OI6ELGmpdbs5ondU',
  },
  {
    title: 'Para Crises de Pânico',
    subtitle: 'Respire fundo, você está segura',
    icon: 'heart',
    url: 'https://youtu.be/wnA5MJkd3tU?si=fNg0wBVueVsl5FqV',
  },
  {
    title: 'Para Crises de Ansiedade',
    subtitle: 'Acalme o corpo e a respiração',
    icon: 'moon-o',
    url: 'https://youtu.be/sJjyX9W-E-Y?si=0OFTyBFoFRAGGgEO',
  },
];

const MeditationScreen = ({ onNavigate }) => {
  return (
    <SafeAreaView style={meditationStyles.safeArea}>
      <ScrollView contentContainerStyle={meditationStyles.container}>
        <Text style={meditationStyles.title}>Musicoterapia 🎵</Text>
        <Text style={meditationStyles.subtitle}>Escolha o que combina com o seu momento</Text>

        <CvvCard />

        {TRACKS.map((track) => (
          <TouchableOpacity
            key={track.title}
            style={meditationStyles.card}
            onPress={() => handleLinkPress(track.url)}
            accessibilityLabel={`Meditação guiada: ${track.title}`}>
            <View style={meditationStyles.iconCircle}>
              <Icon name={track.icon} size={22} color={COLORS.link} />
            </View>
            <View style={meditationStyles.cardTextBox}>
              <Text style={meditationStyles.cardTitle}>{track.title}</Text>
              <Text style={meditationStyles.cardSubtitle}>{track.subtitle}</Text>
            </View>
            <Icon name="play-circle" size={30} color={COLORS.primary} />
          </TouchableOpacity>
        ))}

        <View style={{ height: 80 }} />
      </ScrollView>
      <NavigationFooter current="Meditation" onNavigate={onNavigate} />
    </SafeAreaView>
  );
};

const meditationStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: COLORS.link,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 30,
    textAlign: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    padding: 15,
    marginBottom: 15,
    backgroundColor: 'white',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.secondary,
    borderLeftWidth: 5,
    borderLeftColor: COLORS.primary,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1.5,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardTextBox: {
    flex: 1,
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  cardSubtitle: {
    fontSize: 13,
    color: COLORS.placeholder,
    marginTop: 2,
  },
});

// ======================================================
// DIÁRIO
// ======================================================
const DiaryScreen = ({ user, onLogout, onNavigate }) => {
  const [mood, setMood] = useState('😊');
  const [text, setText] = useState('');
  const [tags, setTags] = useState([]);
  const [history, setHistory] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    getDiaryEntries(user.id).then(setHistory).catch(console.error);
  }, [user.id]);

  const MOOD_OPTIONS = [
    { emoji: '😭', label: 'Triste' },
    { emoji: '😔', label: 'Desanimado' },
    { emoji: '😐', label: 'Neutro' },
    { emoji: '😊', label: 'Feliz' },
    { emoji: '😡', label: 'Irritado' },
  ];

  const TAG_OPTIONS = ['Cólica', 'Irritação', 'Ansiedade', 'Fadiga', 'Insônia', 'Alegria'];

  const toggleTag = (tag) => {
    setTags((prevTags) =>
      prevTags.includes(tag) ? prevTags.filter((t) => t !== tag) : [...prevTags, tag],
    );
  };

  const resetForm = () => {
    setText('');
    setTags([]);
    setMood('😊');
    setEditingId(null);
  };

  const startEdit = (entry) => {
    setEditingId(entry.id);
    setMood(entry.mood);
    setTags(entry.tags);
    setText(entry.text);
    if (scrollRef.current) scrollRef.current.scrollTo({ y: 0, animated: true });
  };

  const handleDelete = (entry) => {
    confirmDelete('Apagar desabafo', 'Tem certeza? Essa ação não pode ser desfeita.', async () => {
      try {
        await deleteDiaryEntry({ id: entry.id, userId: user.id });
        setHistory((prev) => prev.filter((e) => e.id !== entry.id));
        if (editingId === entry.id) resetForm();
      } catch (e) {
        console.error(e);
        Alert.alert('Erro', 'Não foi possível apagar o desabafo.');
      }
    });
  };

  const handleSave = async (action) => {
    if (!text.trim()) {
      Alert.alert('Atenção', 'O campo de desabafo não pode estar vazio.');
      return;
    }

    try {
      if (editingId) {
        const updated = await updateDiaryEntry({
          id: editingId,
          userId: user.id,
          mood,
          tags,
          text: text.trim(),
        });
        setHistory((prev) => prev.map((e) => (e.id === editingId ? updated : e)));
        Alert.alert('Atualizado!', 'Seu desabafo foi atualizado.');
      } else {
        const newEntry = await addDiaryEntry({
          userId: user.id,
          mood,
          tags,
          text: text.trim(),
          action,
        });
        setHistory((prev) => [newEntry, ...prev]);
        Alert.alert(
          'Diário Salvo!',
          `Desabafo marcado como "${newEntry.mood}" e as tags [${newEntry.tags.join(
            ', ',
          )}] foi ${action}.`,
        );
      }
      resetForm();
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Não foi possível salvar o desabafo.');
    }
  };

  const DiaryEntry = ({ entry }) => (
    <View style={diaryStyles.entryCard}>
      <View style={diaryStyles.entryHeader}>
        <Text style={diaryStyles.entryMood}>{entry.mood}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={diaryStyles.entryDate}>{entry.date}</Text>
          <Text
            style={[
              diaryStyles.entryAction,
              entry.action === 'salvo' ? diaryStyles.entrySaved : diaryStyles.entryArchived,
            ]}>
            ({entry.action.toUpperCase()})
          </Text>
        </View>
      </View>
      <Text style={diaryStyles.entryText}>{entry.text}</Text>
      <Text style={diaryStyles.entryTagsText}>
        Tags: <Text style={diaryStyles.entryTagsList}>{entry.tags.join(', ')}</Text>
      </Text>
      <View style={diaryStyles.entryActions}>
        <TouchableOpacity onPress={() => startEdit(entry)} accessibilityLabel="Editar desabafo">
          <Text style={diaryStyles.entryEditText}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(entry)} accessibilityLabel="Apagar desabafo">
          <Text style={diaryStyles.entryDeleteText}>Apagar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={diaryStyles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <ScrollView ref={scrollRef} contentContainerStyle={diaryStyles.container}>
        <Text style={diaryStyles.title}>
          {editingId ? 'Editando desabafo ✏️' : 'Seu Espaço de Desabafo 🌸'}
        </Text>

        <Text style={diaryStyles.subtitle}>Como você está se sentindo hoje?</Text>
        <View style={diaryStyles.moodContainer}>
          {MOOD_OPTIONS.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={[
                diaryStyles.moodButton,
                mood === item.emoji && diaryStyles.moodSelected,
              ]}
              onPress={() => setMood(item.emoji)}>
              <Text style={diaryStyles.moodEmoji}>{item.emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={diaryStyles.subtitle}>Tags/Sintomas:</Text>
        <View style={diaryStyles.tagContainer}>
          {TAG_OPTIONS.map((tag) => (
            <TouchableOpacity
              key={tag}
              style={[
                diaryStyles.tagButton,
                tags.includes(tag) && diaryStyles.tagSelected,
              ]}
              onPress={() => toggleTag(tag)}>
              <Text style={tags.includes(tag) ? diaryStyles.tagTextSelected : diaryStyles.tagText}>
                {tag}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={diaryStyles.subtitle}>Escreva seu desabafo:</Text>
        <TextInput
          style={diaryStyles.input}
          placeholder="O que está na sua mente hoje?"
          placeholderTextColor={COLORS.placeholder}
          multiline
          value={text}
          onChangeText={setText}
        />

        <TouchableOpacity style={diaryStyles.helpHint} onPress={callCVV}>
          <Text style={diaryStyles.helpHintText}>
            Está muito difícil agora? O CVV atende 24h:{' '}
            <Text style={diaryStyles.helpHintLink}>ligue 188</Text>
          </Text>
        </TouchableOpacity>

        <View style={diaryStyles.buttonRow}>
          <TouchableOpacity
            style={[diaryStyles.actionButton, { backgroundColor: COLORS.success }]}
            onPress={() => handleSave('salvo')}>
            <Text style={diaryStyles.actionButtonText}>{editingId ? 'Atualizar' : 'Salvar'}</Text>
          </TouchableOpacity>
          {editingId && (
            <TouchableOpacity
              style={[diaryStyles.actionButton, { backgroundColor: COLORS.secondary }]}
              onPress={resetForm}>
              <Text style={[diaryStyles.actionButtonText, { color: COLORS.text }]}>Cancelar</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text
          style={[diaryStyles.title, { marginTop: 30, fontSize: 22, color: COLORS.text }]}>
          Histórico de Desabafos 📜
        </Text>

        {history.length === 0 ? (
          <Text style={diaryStyles.emptyHistoryText}>Nenhum desabafo registrado ainda.</Text>
        ) : (
          history.map((entry) => <DiaryEntry key={entry.id} entry={entry} />)
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      <NavigationFooter current="Diary" onNavigate={onNavigate} />

      <TouchableOpacity style={diaryStyles.logoutButton} onPress={onLogout}>
        <Text style={diaryStyles.logoutButtonText}>Sair</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const diaryStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    padding: 20,
    alignItems: 'center',
    paddingBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: COLORS.link,
    marginBottom: 30,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 15,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  moodContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
  },
  moodButton: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: COLORS.secondary,
  },
  moodSelected: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  moodEmoji: {
    fontSize: 30,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
    width: '100%',
  },
  tagButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    marginRight: 10,
    marginBottom: 10,
    borderRadius: 20,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: COLORS.secondary,
  },
  tagSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.link,
  },
  tagText: {
    color: COLORS.text,
    fontWeight: '500',
  },
  tagTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  input: {
    width: '100%',
    height: 150,
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.secondary,
    color: COLORS.text,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 30,
  },
  actionButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
    elevation: 2,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  entryCard: {
    width: '100%',
    padding: 15,
    marginBottom: 15,
    borderRadius: 10,
    backgroundColor: 'white',
    borderLeftWidth: 5,
    borderLeftColor: COLORS.primary,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1.5,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.secondary,
    paddingBottom: 5,
  },
  entryMood: {
    fontSize: 28,
  },
  entryDate: {
    fontSize: 12,
    color: COLORS.placeholder,
    marginRight: 10,
  },
  entryAction: {
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 5,
    borderRadius: 3,
    color: 'white',
  },
  entrySaved: {
    backgroundColor: COLORS.success,
  },
  entryArchived: {
    backgroundColor: COLORS.warning,
  },
  entryText: {
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 10,
  },
  entryTagsText: {
    fontSize: 12,
    color: COLORS.placeholder,
  },
  entryTagsList: {
    fontWeight: 'bold',
    color: COLORS.text,
  },
  emptyHistoryText: {
    color: COLORS.placeholder,
    marginTop: 20,
    fontSize: 16,
  },
  helpHint: {
    alignSelf: 'flex-start',
    marginTop: -10,
    marginBottom: 20,
  },
  helpHintText: {
    fontSize: 13,
    color: COLORS.placeholder,
  },
  helpHintLink: {
    color: COLORS.RUBY_RED,
    fontWeight: 'bold',
  },
  entryActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.background,
    paddingTop: 8,
  },
  entryEditText: {
    color: COLORS.link,
    fontWeight: '600',
    marginRight: 20,
  },
  entryDeleteText: {
    color: COLORS.danger,
    fontWeight: '600',
  },
  logoutButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 8,
    borderRadius: 5,
    backgroundColor: COLORS.danger,
    zIndex: 10,
  },
  logoutButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
});

// ======================================================
// FÓRUM
// ======================================================
const Comment = ({ comment, canDelete, onDelete }) => (
  <View style={forumStyles.commentContainer}>
    <View style={forumStyles.commentHeader}>
      <Text style={forumStyles.commentUser}>{comment.user}</Text>
      {canDelete && (
        <TouchableOpacity
          onPress={() => onDelete(comment.id)}
          accessibilityLabel="Apagar comentário">
          <Text style={forumStyles.deleteLink}>Apagar</Text>
        </TouchableOpacity>
      )}
    </View>
    <Text style={forumStyles.commentText}>{comment.text}</Text>
  </View>
);

const Post = ({ post, currentUserId, onAddComment, onDeletePost, onDeleteComment }) => {
  const [commentText, setCommentText] = useState('');
  const [showCommentInput, setShowCommentInput] = useState(false);
  const isOwner = post.userId === currentUserId;

  const handleCommentSubmit = async () => {
    if (commentText.trim()) {
      await onAddComment(post.id, commentText);
      setCommentText('');
      setShowCommentInput(false);
    }
  };

  return (
    <View style={forumStyles.postCard}>
      <Text style={forumStyles.postUser}>{post.user}</Text>
      <Text style={forumStyles.postContent}>{post.content}</Text>
      <Text style={forumStyles.postTimestamp}>{post.timestamp}</Text>

      <View style={forumStyles.postActionsRow}>
        {isOwner ? (
          <TouchableOpacity
            onPress={() => onDeletePost(post.id)}
            accessibilityLabel="Apagar postagem">
            <Text style={forumStyles.deleteLink}>Apagar</Text>
          </TouchableOpacity>
        ) : (
          <View />
        )}
        <TouchableOpacity onPress={() => setShowCommentInput(!showCommentInput)}>
          <Text style={forumStyles.commentLink}>
            {showCommentInput ? 'Cancelar' : `Comentar (${post.comments.length})`}
          </Text>
        </TouchableOpacity>
      </View>

      {showCommentInput && (
        <View style={forumStyles.commentInputContainer}>
          <TextInput
            style={forumStyles.commentInput}
            placeholder="Escreva seu comentário..."
            placeholderTextColor={COLORS.placeholder}
            multiline
            value={commentText}
            onChangeText={setCommentText}
          />
          <TouchableOpacity
            style={forumStyles.commentButton}
            onPress={handleCommentSubmit}>
            <Text style={forumStyles.commentButtonText}>Enviar</Text>
          </TouchableOpacity>
        </View>
      )}

      {post.comments.map((comment) => (
        <Comment
          key={comment.id}
          comment={comment}
          canDelete={comment.userId === currentUserId}
          onDelete={(id) => onDeleteComment(id)}
        />
      ))}
    </View>
  );
};

const ForumScreen = ({ user, onNavigate }) => {
  const [posts, setPosts] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');

  const loadPosts = async () => {
    try {
      setPosts(await getPosts());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const handlePostSubmit = async () => {
    if (!newPostContent.trim()) {
      Alert.alert('Atenção', 'O campo de postagem não pode estar vazio.');
      return;
    }
    try {
      await addPost({ userId: user.id, userName: user.fullName, content: newPostContent });
      setNewPostContent('');
      await loadPosts();
      Alert.alert('Sucesso', 'Sua postagem foi publicada!');
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Não foi possível publicar.');
    }
  };

  const handleAddComment = async (postId, commentText) => {
    try {
      await addComment({
        postId,
        userId: user.id,
        userName: user.fullName,
        text: commentText,
      });
      await loadPosts();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeletePost = (postId) => {
    confirmDelete(
      'Apagar postagem',
      'A postagem e todos os comentários dela serão apagados.',
      async () => {
        try {
          await deletePost({ id: postId, userId: user.id });
          await loadPosts();
        } catch (e) {
          console.error(e);
          Alert.alert('Erro', 'Não foi possível apagar a postagem.');
        }
      },
    );
  };

  const handleDeleteComment = (commentId) => {
    confirmDelete('Apagar comentário', 'Tem certeza?', async () => {
      try {
        await deleteComment({ id: commentId, userId: user.id });
        await loadPosts();
      } catch (e) {
        console.error(e);
        Alert.alert('Erro', 'Não foi possível apagar o comentário.');
      }
    });
  };

  return (
    <SafeAreaView style={forumStyles.safeArea}>
      <View style={forumStyles.container}>
        <Text style={forumStyles.title}>Comunidade de Apoio 🫂</Text>

        <View style={forumStyles.newPostContainer}>
          <TextInput
            style={forumStyles.postInput}
            placeholder="O que você gostaria de compartilhar com a comunidade?"
            placeholderTextColor={COLORS.placeholder}
            multiline
            value={newPostContent}
            onChangeText={setNewPostContent}
          />
          <TouchableOpacity
            style={forumStyles.postButton}
            onPress={handlePostSubmit}
            disabled={!newPostContent.trim()}>
            <Text style={forumStyles.postButtonText}>Publicar</Text>
          </TouchableOpacity>
        </View>

        <Text style={forumStyles.subtitle}>Postagens Recentes:</Text>

        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Post
              post={item}
              currentUserId={user.id}
              onAddComment={handleAddComment}
              onDeletePost={handleDeletePost}
              onDeleteComment={handleDeleteComment}
            />
          )}
          contentContainerStyle={{ paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
        />
      </View>
      <NavigationFooter current="Forum" onNavigate={onNavigate} />
    </SafeAreaView>
  );
};

const forumStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: COLORS.link,
    marginBottom: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 10,
    marginBottom: 10,
  },
  newPostContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.secondary,
  },
  postInput: {
    minHeight: 80,
    fontSize: 16,
    color: COLORS.text,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  postButton: {
    backgroundColor: COLORS.primary,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  postButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  postCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.secondary,
  },
  postUser: {
    fontWeight: 'bold',
    color: COLORS.link,
    marginBottom: 5,
  },
  postContent: {
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 10,
  },
  postTimestamp: {
    fontSize: 12,
    color: COLORS.placeholder,
    textAlign: 'right',
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 5,
  },
  commentLink: {
    color: COLORS.link,
    fontWeight: '600',
  },
  commentInputContainer: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 10,
  },
  commentInput: {
    minHeight: 40,
    backgroundColor: COLORS.background,
    borderRadius: 5,
    padding: 8,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 5,
  },
  commentButton: {
    backgroundColor: COLORS.secondary,
    padding: 8,
    borderRadius: 5,
    alignItems: 'center',
  },
  commentButtonText: {
    color: COLORS.link,
    fontWeight: 'bold',
    fontSize: 14,
  },
  postActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  deleteLink: {
    color: COLORS.danger,
    fontWeight: '600',
    fontSize: 13,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  commentContainer: {
    backgroundColor: COLORS.background,
    borderRadius: 5,
    padding: 10,
    marginTop: 8,
    marginLeft: 10,
  },
  commentUser: {
    fontWeight: 'bold',
    fontSize: 12,
    color: COLORS.primary,
    marginBottom: 2,
  },
  commentText: {
    fontSize: 14,
    color: COLORS.text,
  },
});

// ======================================================
// CALENDÁRIO
// ======================================================
// Calendário em português do Brasil
LocaleConfig.locales['pt-br'] = {
  monthNames: [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ],
  monthNamesShort: [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ],
  dayNames: [
    'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
    'Quinta-feira', 'Sexta-feira', 'Sábado',
  ],
  dayNamesShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  today: 'Hoje',
};
LocaleConfig.defaultLocale = 'pt-br';

const today = new Date().toISOString().split('T')[0];

const addDays = (dateStr, n) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
};

const periodMarkings = (start, end) => {
  const m = {};
  if (!start) return m;
  if (!end) {
    m[start] = { startingDay: true, endingDay: true, color: COLORS.primary, textColor: 'white' };
    return m;
  }
  let cur = start;
  while (cur <= end) {
    m[cur] = {
      color: COLORS.primary,
      textColor: 'white',
      startingDay: cur === start,
      endingDay: cur === end,
    };
    cur = addDays(cur, 1);
  }
  return m;
};

const CycleHistoryItem = ({ start, end, index, onDelete }) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffTime = Math.abs(endDate - startDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  return (
    <View style={calendarStyles.historyCard}>
      <Text style={calendarStyles.historyTitle}>Ciclo #{index + 1} Registrado</Text>
      <Text style={calendarStyles.historyDate}>
        De: <Text style={calendarStyles.historyValue}>{start}</Text>
      </Text>
      <Text style={calendarStyles.historyDate}>
        Até: <Text style={calendarStyles.historyValue}>{end}</Text>
      </Text>
      <Text style={calendarStyles.historyDuration}>
        Duração: <Text style={calendarStyles.historyValue}>{diffDays} dias</Text>
      </Text>
      <TouchableOpacity
        style={calendarStyles.deleteButton}
        onPress={onDelete}
        accessibilityLabel="Apagar ciclo">
        <Text style={calendarStyles.deleteText}>Apagar</Text>
      </TouchableOpacity>
    </View>
  );
};

const CalendarScreen = ({ user, onNavigate }) => {
  const [cycleHistory, setCycleHistory] = useState([]);
  const [currentCycle, setCurrentCycle] = useState({ start: null, end: null });

  useEffect(() => {
    getCycles(user.id).then(setCycleHistory).catch(console.error);
  }, [user.id]);

  const handleDayPress = (day) => {
    const dateString = day.dateString;

    if (!currentCycle.start) {
      setCurrentCycle({ start: dateString, end: null });
      return;
    }

    if (currentCycle.start === dateString) {
      setCurrentCycle({ start: null, end: null });
      return;
    }

    if (dateString < currentCycle.start) {
      Alert.alert('Erro', 'O final do ciclo deve ser depois da data de início.');
      return;
    }

    setCurrentCycle((prev) => ({ ...prev, end: dateString }));
  };

  const generateMarkings = useMemo(() => {
    const markings = {};
    cycleHistory.forEach((c) => Object.assign(markings, periodMarkings(c.start, c.end)));
    Object.assign(markings, periodMarkings(currentCycle.start, currentCycle.end));
    return markings;
  }, [cycleHistory, currentCycle]);

  const handleSaveCycle = async () => {
    if (!currentCycle.start || !currentCycle.end) {
      Alert.alert('Atenção', 'Selecione a data de início e de fim para salvar o ciclo.');
      return;
    }
    try {
      const saved = await addCycle({
        userId: user.id,
        start: currentCycle.start,
        end: currentCycle.end,
      });
      setCycleHistory((prev) => [saved, ...prev]);
      setCurrentCycle({ start: null, end: null });
      Alert.alert('Sucesso', 'Ciclo registrado!');
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Não foi possível registrar o ciclo.');
    }
  };

  const handleDeleteCycle = (cycle) => {
    confirmDelete(
      'Apagar ciclo',
      `Apagar o ciclo de ${cycle.start} até ${cycle.end}?`,
      async () => {
        try {
          await deleteCycle({ id: cycle.id, userId: user.id });
          setCycleHistory((prev) => prev.filter((c) => c.id !== cycle.id));
        } catch (e) {
          console.error(e);
          Alert.alert('Erro', 'Não foi possível apagar o ciclo.');
        }
      },
    );
  };

  const handleClearSelection = () => {
    setCurrentCycle({ start: null, end: null });
    Alert.alert('Limpo', 'Seleção atual removida.');
  };

  return (
    <SafeAreaView style={calendarStyles.safeArea}>
      <ScrollView contentContainerStyle={calendarStyles.scrollContainer}>
        <Text style={calendarStyles.title}>Acompanhamento Menstrual 🩸</Text>

        <View style={calendarStyles.currentSelection}>
          <Text style={calendarStyles.selectionText}>
            Início:{' '}
            <Text style={calendarStyles.selectionValue}>
              {currentCycle.start || '... Clique em uma data'}
            </Text>
          </Text>
          <Text style={calendarStyles.selectionText}>
            Fim:{' '}
            <Text style={calendarStyles.selectionValue}>
              {currentCycle.end || '... Clique em uma data'}
            </Text>
          </Text>
        </View>

        <View style={calendarStyles.calendarWrapper}>
          <Calendar
            onDayPress={handleDayPress}
            markedDates={generateMarkings}
            markingType={'period'}
            theme={{
              selectedDayBackgroundColor: COLORS.primary,
              selectedDayTextColor: 'white',
              todayTextColor: COLORS.primary,
              arrowColor: COLORS.primary,
              'stylesheet.calendar.header': {
                dayHeader: {
                  color: COLORS.primary,
                },
              },
            }}
            initialDate={today}
            monthFormat={'MMMM yyyy'}
            hideExtraDays={true}
            firstDay={1}
          />
        </View>

        <View style={calendarStyles.buttonRow}>
          <TouchableOpacity
            style={[calendarStyles.actionButton, { backgroundColor: COLORS.success }]}
            onPress={handleSaveCycle}
            disabled={!currentCycle.start || !currentCycle.end}>
            <Text style={calendarStyles.buttonText}>Registrar Ciclo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[calendarStyles.actionButton, { backgroundColor: COLORS.secondary }]}
            onPress={handleClearSelection}
            disabled={!currentCycle.start && !currentCycle.end}>
            <Text style={[calendarStyles.buttonText, { color: COLORS.text }]}>Limpar</Text>
          </TouchableOpacity>
        </View>

        <Text style={calendarStyles.historySectionTitle}>
          Histórico de Ciclos Registrados
        </Text>
        {cycleHistory.length === 0 ? (
          <Text style={calendarStyles.emptyHistoryText}>Nenhum ciclo registrado ainda.</Text>
        ) : (
          cycleHistory.map((cycle, index) => (
            <CycleHistoryItem
              key={cycle.id}
              start={cycle.start}
              end={cycle.end}
              index={cycleHistory.length - 1 - index}
              onDelete={() => handleDeleteCycle(cycle)}
            />
          ))
        )}
      </ScrollView>
      <NavigationFooter current="calendar" onNavigate={onNavigate} />
    </SafeAreaView>
  );
};

const calendarStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 100,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 30,
  },
  calendarWrapper: {
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.secondary,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 30,
    backgroundColor: 'white',
  },
  currentSelection: {
    width: '100%',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 5,
    borderLeftColor: COLORS.primary,
    marginBottom: 20,
    elevation: 1,
  },
  selectionText: {
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 5,
  },
  selectionValue: {
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 30,
  },
  actionButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
    elevation: 2,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  navButton: {
    marginTop: 20,
    padding: 10,
  },
  navButtonText: {
    color: COLORS.link,
    fontSize: 16,
    fontWeight: '600',
  },
  historySectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 15,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  historyCard: {
    width: '100%',
    padding: 15,
    marginBottom: 10,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.secondary,
    borderLeftWidth: 5,
    borderLeftColor: COLORS.link,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 5,
  },
  historyDate: {
    fontSize: 14,
    color: COLORS.text,
  },
  historyValue: {
    fontWeight: '600',
  },
  deleteButton: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  deleteText: {
    color: COLORS.danger,
    fontWeight: '600',
    fontSize: 13,
  },
  historyDuration: {
    fontSize: 14,
    color: COLORS.placeholder,
    marginTop: 5,
  },
  emptyHistoryText: {
    color: COLORS.placeholder,
    marginTop: 5,
    fontSize: 14,
  },
});

// ======================================================
// AUTENTICAÇÃO
// ======================================================
const AuthScreen = ({ onLogin, onRegister }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Erro', 'Por favor, preencha E-mail e Senha.');
      return;
    }

    if (!isLogin) {
      if (!fullName.trim() || !age.trim()) {
        Alert.alert('Erro', 'Por favor, preencha Nome Completo e Idade.');
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert('Erro', 'As senhas não coincidem.');
        return;
      }
    }

    setIsLoading(true);
    try {
      const result = isLogin
        ? await onLogin({ email, password })
        : await onRegister({ email, password, fullName, age });

      if (!result.success) {
        Alert.alert('Erro', result.message);
      }
      // Em caso de sucesso, o RootApp troca de tela sozinho
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Algo deu errado. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      'Recuperar Senha',
      'Um link de recuperação será enviado para o seu e-mail.',
    );
  };

  return (
    <SafeAreaView style={authStyles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <View style={authStyles.container}>
        <Text style={authStyles.title}>
          {isLogin ? '👋 Bem-vindo(a) de Volta!' : '✨ Crie sua Conta'}
        </Text>

        {!isLogin && (
          <>
            <TextInput
              style={authStyles.input}
              placeholder="Nome Completo"
              placeholderTextColor={COLORS.placeholder}
              value={fullName}
              onChangeText={setFullName}
              editable={!isLoading}
            />
            <TextInput
              style={authStyles.input}
              placeholder="Idade"
              placeholderTextColor={COLORS.placeholder}
              keyboardType="numeric"
              value={age}
              onChangeText={setAge}
              maxLength={3}
              editable={!isLoading}
            />
          </>
        )}

        <TextInput
          style={authStyles.input}
          placeholder="E-mail"
          placeholderTextColor={COLORS.placeholder}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          editable={!isLoading}
        />

        <TextInput
          style={authStyles.input}
          placeholder="Senha"
          placeholderTextColor={COLORS.placeholder}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!isLoading}
        />

        {!isLogin && (
          <TextInput
            style={authStyles.input}
            placeholder="Confirmar Senha"
            placeholderTextColor={COLORS.placeholder}
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            editable={!isLoading}
          />
        )}

        {isLogin && (
          <TouchableOpacity
            style={authStyles.forgotPasswordContainer}
            onPress={handleForgotPassword}
            disabled={isLoading}>
            <Text style={authStyles.forgotPasswordText}>Esqueceu a senha?</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            authStyles.button,
            (isLoading || !email.trim() || !password.trim()) && { opacity: 0.7 },
          ]}
          onPress={handleSubmit}
          disabled={isLoading || !email.trim() || !password.trim()}>
          <Text style={authStyles.buttonText}>
            {isLoading ? 'Aguarde...' : isLogin ? 'Entrar' : 'Cadastrar'}
          </Text>
        </TouchableOpacity>

        <Text style={authStyles.orText}>
          {isLogin ? 'Não tem conta?' : 'Já tem uma conta?'}
        </Text>

        <Button
          title={isLogin ? 'Criar uma conta' : 'Fazer Login'}
          color={COLORS.link}
          onPress={() => setIsLogin(!isLogin)}
          disabled={isLoading}
        />
      </View>
    </SafeAreaView>
  );
};

const authStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 40,
  },
  input: {
    width: '100%',
    padding: 15,
    marginBottom: 15,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.secondary,
    color: COLORS.text,
  },
  forgotPasswordContainer: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: COLORS.link,
    fontSize: 14,
    fontWeight: '600',
  },
  button: {
    width: '100%',
    padding: 15,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  orText: {
    color: COLORS.text,
    fontSize: 14,
    marginTop: 10,
  },
});

// ======================================================
// APP RAIZ
// ======================================================
const RootApp = () => {
  const [dbReady, setDbReady] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentScreen, setCurrentScreen] = useState('Diary');

  useEffect(() => {
    (async () => {
      try {
        await initDatabase();
      } catch (e) {
        console.error(e);
        Alert.alert('Erro', 'Não foi possível iniciar o banco de dados.');
        return;
      }

      // Restaura o login anterior, se houver
      try {
        const savedId = await loadSession();
        if (savedId) {
          const user = await getUserById(savedId);
          if (user) setCurrentUser(user);
          else await clearSession();
        }
      } catch (e) {
        console.error(e);
      }

      setDbReady(true);
    })();
  }, []);

  const handleLogin = async (data) => {
    const result = await loginUser(data);
    if (result.success) {
      await saveSession(result.user.id);
      setCurrentUser(result.user);
    }
    return result;
  };

  const handleRegister = async (data) => {
    const result = await registerUser(data);
    if (result.success) {
      await saveSession(result.user.id);
      setCurrentUser(result.user);
    }
    return result;
  };

  const handleNavigate = (screenName) => setCurrentScreen(screenName);

  const handleLogout = async () => {
    await clearSession();
    setCurrentUser(null);
    setCurrentScreen('Diary');
  };

  if (!dbReady) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: COLORS.background,
        }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!currentUser) {
    return <AuthScreen onLogin={handleLogin} onRegister={handleRegister} />;
  }

  let ScreenComponent;
  switch (currentScreen) {
    case 'Meditation':
      ScreenComponent = <MeditationScreen onNavigate={handleNavigate} />;
      break;
    case 'Forum':
      ScreenComponent = <ForumScreen user={currentUser} onNavigate={handleNavigate} />;
      break;
    case 'calendar':
      ScreenComponent = <CalendarScreen user={currentUser} onNavigate={handleNavigate} />;
      break;
    case 'Diary':
    default:
      ScreenComponent = (
        <DiaryScreen user={currentUser} onLogout={handleLogout} onNavigate={handleNavigate} />
      );
      break;
  }

  return <View style={{ flex: 1 }}>{ScreenComponent}</View>;
};

export default RootApp;
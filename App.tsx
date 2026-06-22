import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { EngineProvider } from './src/engine/EngineProvider';

export default function App() {
  const engine = useMemo(() => EngineProvider.create(), []);
  const [inputUri, setInputUri] = useState<string | null>(null);
  const [resultUri, setResultUri] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('需要相册权限', '请在系统设置中允许访问相册后重试。');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (!result.canceled && result.assets.length > 0) {
      setInputUri(result.assets[0].uri);
      setResultUri(null);
    }
  };

  const removeCloud = async () => {
    if (!inputUri || processing) return;
    setProcessing(true);
    try {
      const uri = await engine.removeCloud(inputUri);
      setResultUri(uri);
    } catch (e) {
      Alert.alert('处理失败', e instanceof Error ? e.message : String(e));
    } finally {
      setProcessing(false);
    }
  };

  const saveResult = async () => {
    if (!resultUri || saving) return;
    setSaving(true);
    try {
      const permission = await requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('需要相册权限', '请在系统设置中允许保存到相册后重试。');
        return;
      }
      await Asset.create(resultUri);
      Alert.alert('已保存', '去云结果已保存到相册。');
    } catch (e) {
      Alert.alert('保存失败', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title}>云去除</Text>
        <Text style={styles.subtitle}>遥感图像去云 · {engine.name}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.outlineButton} onPress={pickImage} activeOpacity={0.8}>
          <Text style={styles.outlineButtonText}>选择遥感图像</Text>
        </TouchableOpacity>

        {!inputUri ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>☁️</Text>
            <Text style={styles.emptyText}>选择一张含云的遥感 / 卫星图像开始</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>原图（含云）</Text>
            <Image source={{ uri: inputUri }} style={styles.image} resizeMode="contain" />
          </View>
        )}

        {inputUri && (
          <TouchableOpacity
            style={[styles.primaryButton, processing && styles.buttonDisabled]}
            onPress={removeCloud}
            disabled={processing}
            activeOpacity={0.8}>
            {processing ? (
              <View style={styles.row}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.primaryButtonText}>  正在去云…</Text>
              </View>
            ) : (
              <Text style={styles.primaryButtonText}>一键去云</Text>
            )}
          </TouchableOpacity>
        )}

        {resultUri && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>去云结果</Text>
              <Image source={{ uri: resultUri }} style={styles.image} resizeMode="contain" />
            </View>
            <TouchableOpacity
              style={[styles.primaryButton, saving && styles.buttonDisabled]}
              onPress={saveResult}
              disabled={saving}
              activeOpacity={0.8}>
              <Text style={styles.primaryButtonText}>{saving ? '保存中…' : '保存到相册'}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const PRIMARY = '#1565C0';

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  header: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginTop: 4,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  outlineButton: {
    borderWidth: 1.5,
    borderColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  outlineButtonText: {
    color: PRIMARY,
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: '#ECEFF1',
  },
  emptyCard: {
    backgroundColor: '#ECEFF1',
    borderRadius: 12,
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    color: '#5f6b76',
    fontSize: 14,
  },
});

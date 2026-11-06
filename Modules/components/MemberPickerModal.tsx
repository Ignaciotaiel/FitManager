import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexto/themeContext';
import { withAlpha } from '../../Styles/theme/colors';
import Input from './Input';
import Button from './Button';
import StatusBanner from './StatusBanner';

export interface PickerMember {
  id: number | string;
  name?: string | null;
  email?: string | null;
}

export interface MemberPickerModalProps {
  visible: boolean;
  members: PickerMember[];
  selectedIds: Array<number | string>;
  onToggle: (id: number | string) => void;
  onClear: () => void;
  onClose: () => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  inline?: boolean;
}

// panel independiente para elegir socios (seleccion multiple con buscador).
// usa su propia FlatList en lugar de una lista anidada dentro del formulario,
// por lo que no puede superponerse con el resto de la pantalla.
export function MemberPickerModal({
  visible,
  members,
  selectedIds,
  onToggle,
  onClear,
  onClose,
  loading = false,
  error = null,
  onRetry,
  inline = false
}: MemberPickerModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState<string>('');
  const normalizedSelectedIds = useMemo(() => selectedIds.map(Number), [selectedIds]);

  // al abrir el selector se limpia la busqueda; las selecciones viven en el componente padre y se conservan
  useEffect(() => {
    if (visible) setQuery('');
  }, [visible]);

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        (m.name && m.name.toLowerCase().includes(q)) ||
        (m.email && m.email.toLowerCase().includes(q))
    );
  }, [members, query]);

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.centerText, { color: colors.textSecondary }]}>cargando socios...</Text>
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.centerBox}>
          <StatusBanner message={error} type="error" />
          {onRetry ? <Button title="REINTENTAR" variant="secondary" onPress={onRetry} /> : null}
        </View>
      );
    }
    if (members.length === 0) {
      return (
        <View style={styles.centerBox}>
          <Ionicons name="people-outline" size={32} color={colors.textMuted} />
          <Text style={[styles.centerText, { color: colors.textSecondary }]}>
            no hay socios activos disponibles para asignar.
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.centerBox}>
        <Ionicons name="search-outline" size={32} color={colors.textMuted} />
        <Text style={[styles.centerText, { color: colors.textSecondary }]}>
          no se encontraron socios con esa búsqueda.
        </Text>
      </View>
    );
  };

  const panelContent = (
    <View
      style={[
        inline ? styles.inlineSheet : styles.sheet,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          paddingBottom: inline ? 4 : 12 + insets.bottom
        }
      ]}
    >
      {/* cabecera con acceso siempre visible para cerrar (no depende del teclado) */}
      <View style={styles.header}>
        <View style={styles.headerTextCol}>
          <Text style={[styles.title, { color: colors.text }]}>SELECCIONAR SOCIOS</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {selectedIds.length} {selectedIds.length === 1 ? 'seleccionado' : 'seleccionados'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          style={[styles.doneBtn, { backgroundColor: colors.primary }]}
          accessibilityRole="button"
          accessibilityLabel="confirmar selección de socios"
        >
          <Text style={[styles.doneBtnText, { color: colors.primaryText }]}>LISTO</Text>
        </TouchableOpacity>
      </View>

      <Input
        placeholder="buscar socio por nombre o correo..."
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        style={styles.search}
      />

      <FlatList
        data={filteredMembers}
        keyExtractor={(item) => String(item.id)}
        extraData={selectedIds}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={renderEmpty}
        renderItem={({ item }) => {
          const selected = normalizedSelectedIds.includes(Number(item.id));
          return (
            <TouchableOpacity
              onPress={() => onToggle(Number(item.id))}
              activeOpacity={0.8}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              style={[
                styles.row,
                {
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? withAlpha(colors.primary, 0.1) : colors.surface
                }
              ]}
            >
              <Ionicons
                name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={selected ? colors.primary : colors.textMuted}
              />
              <View style={styles.rowInfo}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {item.name || 'sin nombre'}
                </Text>
                <Text style={[styles.email, { color: colors.textSecondary }]} numberOfLines={1}>
                  {item.email}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <View style={styles.footer}>
        <Button
          title="DESMARCAR TODOS"
          variant="secondary"
          onPress={onClear}
          disabled={selectedIds.length === 0}
          style={styles.footerBtn}
        />
        <Button title="CONFIRMAR" onPress={onClose} style={styles.footerBtn} />
      </View>
    </View>
  );

  if (inline) {
    if (!visible) return null;
    return panelContent;
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
      >
        {panelContent}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  sheet: {
    height: '85%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 16
  },
  inlineSheet: {
    height: 460,
    maxHeight: '100%'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  headerTextCol: {
    flex: 1,
    paddingRight: 12
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2
  },
  doneBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10
  },
  doneBtnText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6
  },
  search: {
    marginVertical: 4
  },
  list: {
    flex: 1,
    marginTop: 6
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 8
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginVertical: 3,
    gap: 12
  },
  rowInfo: {
    flex: 1
  },
  name: {
    fontSize: 14,
    fontWeight: '800'
  },
  email: {
    fontSize: 12,
    marginTop: 1
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    gap: 10
  },
  centerText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8
  },
  footerBtn: {
    flex: 1
  }
});

export default MemberPickerModal;


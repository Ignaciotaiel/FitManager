// Define los estilos visuales del selector múltiple de socios MemberPickerModal.
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  sheet: {
    height: '85%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
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

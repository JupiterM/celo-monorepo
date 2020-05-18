import colors from '@celo/react-components/styles/colors.v2'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import { setBackupDelayed } from 'src/account/actions'
import CeloAnalytics from 'src/analytics/CeloAnalytics'
import { CustomEventNames } from 'src/analytics/constants'
import { Namespaces } from 'src/i18n'
import { navigateBack } from 'src/navigator/NavigationService'
import { TopBarTextButton } from 'src/navigator/TopBarButton.v2'
import { RootState } from 'src/redux/reducers'
import { isBackupTooLate } from 'src/redux/selectors'

interface StateProps {
  backupTooLate: boolean
  backupDelayedTime: number
}

const mapStateToProps = (state: RootState): StateProps => {
  return {
    backupTooLate: isBackupTooLate(state),
    backupDelayedTime: state.account.backupDelayedTime,
  }
}

export default function DelayButton() {
  const { backupTooLate, backupDelayedTime } = useSelector(mapStateToProps, shallowEqual)
  const dispatch = useDispatch()

  const onPressDelay = React.useCallback(() => {
    dispatch(setBackupDelayed())
    CeloAnalytics.track(CustomEventNames.delay_backup)
    navigateBack()
  }, [dispatch])

  const { t } = useTranslation(Namespaces.backupKeyFlow6)

  if (backupTooLate && !backupDelayedTime) {
    return (
      <TopBarTextButton titleStyle={styles.root} onPress={onPressDelay} title={t('delayBackup')} />
    )
  } else {
    return <View />
  }
}

const styles = StyleSheet.create({
  root: {
    color: colors.gray4,
  },
})

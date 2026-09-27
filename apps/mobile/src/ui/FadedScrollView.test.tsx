import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { FadedScrollView } from './FadedScrollView';

const scrollTo = (y: number) => ({ nativeEvent: { contentOffset: { x: 0, y }, contentSize: { width: 300, height: 2000 }, layoutMeasurement: { width: 300, height: 500 } } });

test('the top edge fades only once the content has scrolled', async () => {
  await render(
    <FadedScrollView testID="list">
      <Text>Row</Text>
    </FadedScrollView>,
  );
  expect(screen.queryByTestId('scroll-fade')).toBeNull();
  await fireEvent.scroll(screen.getByTestId('list'), scrollTo(120));
  expect(screen.getByTestId('scroll-fade')).toBeOnTheScreen();
  await fireEvent.scroll(screen.getByTestId('list'), scrollTo(0));
  expect(screen.queryByTestId('scroll-fade')).toBeNull();
});
